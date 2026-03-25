import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';

import { OcrService } from './ocr.service';
import { OcrPrescriptionResponseDto } from './dto/ocr.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@ApiTags('OCR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * @route   POST /api/v1/ocr/prescription
   *
   * Accepts a prescription image (JPEG/PNG/PDF).
   * Returns structured data extracted by Python OCR service.
   *
   * IMPORTANT — unknownDosage flag:
   * If OCR cannot parse the dosage, unknownDosage=true is returned.
   * Frontend MUST use this flag to force the user to enter dosage manually
   * before calling POST /medications/prescriptions.
   */
  @Post('prescription')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiOperation({
    summary: 'Scan prescription image with OCR',
    description: `
Processes a prescription image using the Python OCR microservice.

**Response flags to handle on the frontend:**
- \`unknownDosage = true\` → OCR failed to parse dosage → MUST prompt user for manual entry
- \`success = false\` → full OCR failure → user should enter all fields manually

**Integration flow:**
1. Upload image → get \`OcrPrescriptionResponseDto\`
2. Pre-fill the CreatePrescription form with extracted data
3. If \`unknownDosage = true\` → show mandatory dosage input field
4. Call POST /medications/prescriptions with the filled form

**Tech Stack:** Python (FastAPI/Flask + Tesseract/EasyOCR/Google Vision)
**Communication:** REST (primary) → gRPC (fallback)
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Prescription image (JPEG, PNG, WebP, PDF — max 10MB)',
        },
      },
    },
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Language hint for OCR',
    example: 'vi',
    enum: ['vi', 'en'],
  })
  @ApiOkResponse({
    description: 'OCR extraction result',
    type: OcrPrescriptionResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'OCR service unavailable (both REST and gRPC failed)',
  })
  async scanPrescription(
    @UploadedFile() file: Express.Multer.File,
    @Query('language') language = 'vi',
  ): Promise<OcrPrescriptionResponseDto> {
    if (!file) {
      throw new BadRequestException('Prescription image file is required.');
    }

    return this.ocrService.processPrescriptionImage(
      file.buffer,
      file.mimetype,
      file.originalname,
      language,
    );
  }
}
