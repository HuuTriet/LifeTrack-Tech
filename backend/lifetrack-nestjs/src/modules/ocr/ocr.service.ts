import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as FormData from 'form-data';

import { ConsulService } from '../../consul/consul.service';
import { OcrPrescriptionResponseDto } from './dto/ocr.dto';

/**
 * OcrService integrates with the Python OCR microservice via:
 * 1. REST (HTTP POST with multipart/form-data) — primary method
 * 2. gRPC — fallback method for low-latency or streaming scenarios
 *
 * The Python service is discovered via Consul (service name: "ocr-service").
 * Falls back to OCR_SERVICE_URL env var if Consul is unavailable.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private grpcClient: any;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly consulService: ConsulService,
  ) {
    this.initGrpcClient();
  }

  // =====================================================================
  // REST Integration (Primary)
  // =====================================================================

  /**
   * Send prescription image to Python OCR service via REST.
   * Handles the response and maps to our internal DTO.
   *
   * OCR Exception Handling (Business Rule):
   * - If OCR succeeds but dosage could not be extracted → unknownDosage = true
   * - Frontend must then prompt for manual dosage entry
   * - Backend will enforce HTTP 422 on CreatePrescription if dosage still missing
   */
  async processPrescriptionImage(
    imageBuffer: Buffer,
    mimeType: string,
    originalName: string,
    language = 'vi',
  ): Promise<OcrPrescriptionResponseDto> {
    const ocrServiceUrl = await this.consulService.getServiceUrl(
      'ocr-service',
      this.configService.get<string>('OCR_SERVICE_URL') || 'http://localhost:8001',
    );

    const timeoutMs =
      this.configService.get<number>('OCR_TIMEOUT_MS') || 10000;

    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: originalName,
      contentType: mimeType,
    });
    formData.append('language', language);

    this.logger.log(`Sending image to OCR service at ${ocrServiceUrl}/ocr/prescription`);

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${ocrServiceUrl}/ocr/prescription`, formData, {
            headers: {
              ...formData.getHeaders(),
            },
            maxContentLength: 10 * 1024 * 1024, // 10MB
          })
          .pipe(
            timeout(timeoutMs),
            catchError((err) => {
              throw new Error(`OCR REST call failed: ${err.message}`);
            }),
          ),
      );

      return this.mapOcrRestResponse(response.data);
    } catch (err) {
      this.logger.warn(
        `OCR REST failed: ${err.message}. Attempting gRPC fallback...`,
      );

      // Attempt gRPC fallback
      try {
        return await this.processPrescriptionImageGrpc(
          imageBuffer,
          mimeType,
          language,
        );
      } catch (grpcErr) {
        this.logger.error(`OCR gRPC fallback also failed: ${grpcErr.message}`);
        throw new ServiceUnavailableException(
          'OCR service is currently unavailable. Please enter medication details manually.',
        );
      }
    }
  }

  /**
   * Map raw Python OCR service response to internal DTO.
   *
   * Key mapping: if `dosage` is null/undefined/zero in response
   * → set unknownDosage = true (triggers HTTP 422 on prescription creation).
   */
  private mapOcrRestResponse(data: Record<string, any>): OcrPrescriptionResponseDto {
    const dosage = data.dosage ?? data.dose_amount ?? null;
    const unknownDosage = dosage === null || dosage === undefined || dosage === 0;

    return {
      success: data.success ?? true,
      rawText: data.raw_text || data.rawText || '',
      confidenceScore: parseFloat(data.confidence_score ?? data.confidenceScore ?? 0),
      drugName: data.drug_name || data.drugName || undefined,
      dosage: unknownDosage ? undefined : parseFloat(dosage),
      dosageUnit: data.dosage_unit || data.dosageUnit || undefined,
      frequency: data.frequency || undefined,
      doctorName: data.doctor_name || data.doctorName || undefined,
      hospitalName: data.hospital_name || data.hospitalName || undefined,
      prescribedDate: data.prescribed_date || data.prescribedDate || undefined,
      unknownDosage,
      errorMessage: data.error_message || data.errorMessage || undefined,
      imageUrl: data.image_url || data.imageUrl || undefined,
    };
  }

  // =====================================================================
  // gRPC Integration (Fallback / Low-latency)
  // =====================================================================

  private initGrpcClient(): void {
    try {
      const protoPath = path.join(__dirname, '../../../proto/ocr.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const grpcObject = grpc.loadPackageDefinition(packageDefinition) as any;
      const OcrProto = grpcObject?.lifetrack?.ocr;

      if (!OcrProto?.OcrService) {
        this.logger.warn('gRPC proto definition not found. gRPC fallback disabled.');
        return;
      }

      const grpcHost = this.configService.get<string>('OCR_SERVICE_GRPC_HOST') || 'localhost';
      const grpcPort = this.configService.get<number>('OCR_SERVICE_GRPC_PORT') || 50051;

      this.grpcClient = new OcrProto.OcrService(
        `${grpcHost}:${grpcPort}`,
        grpc.credentials.createInsecure(),
      );

      this.logger.log(`gRPC OCR client initialized at ${grpcHost}:${grpcPort}`);
    } catch (err) {
      this.logger.warn(`gRPC OCR client initialization failed: ${err.message}`);
    }
  }

  /**
   * gRPC fallback — calls Python OCR service's ProcessPrescription RPC.
   * Defined in proto/ocr.proto
   */
  private processPrescriptionImageGrpc(
    imageBuffer: Buffer,
    mimeType: string,
    language: string,
  ): Promise<OcrPrescriptionResponseDto> {
    return new Promise((resolve, reject) => {
      if (!this.grpcClient) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      const deadline = new Date();
      deadline.setSeconds(
        deadline.getSeconds() +
          Math.ceil(
            (this.configService.get<number>('OCR_TIMEOUT_MS') || 10000) / 1000,
          ),
      );

      this.grpcClient.ProcessPrescription(
        {
          image_data: imageBuffer,
          mime_type: mimeType,
          language,
        },
        { deadline },
        (err: Error, response: Record<string, any>) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.mapOcrGrpcResponse(response));
        },
      );
    });
  }

  private mapOcrGrpcResponse(response: Record<string, any>): OcrPrescriptionResponseDto {
    const dosage = response.dosage ?? null;
    const unknownDosage = dosage === null || dosage === 0;

    return {
      success: response.success ?? true,
      rawText: response.raw_text || '',
      confidenceScore: parseFloat(response.confidence_score ?? 0),
      drugName: response.drug_name || undefined,
      dosage: unknownDosage ? undefined : parseFloat(dosage),
      dosageUnit: response.dosage_unit || undefined,
      frequency: response.frequency || undefined,
      doctorName: response.doctor_name || undefined,
      hospitalName: response.hospital_name || undefined,
      prescribedDate: response.prescribed_date || undefined,
      unknownDosage,
      errorMessage: response.error_message || undefined,
      imageUrl: response.image_url || undefined,
    };
  }
}
