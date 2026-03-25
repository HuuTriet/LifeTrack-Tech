import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { MedicationRepository } from './medication.repository';
import { CreatePrescriptionDto, CreatePrescriptionItemDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import {
  DrugInteractionCheckResponse,
  DrugInteractionResult,
} from './dto/drug-interaction.dto';
import { ConsulService } from '../../consul/consul.service';

import { Prescription } from '../../entities/medication/prescription.entity';
import { PrescriptionItem } from '../../entities/medication/prescription-item.entity';
import {
  InteractionLog,
  InteractionCheckStatus,
  InteractionSeverity,
} from '../../entities/medication/interaction-log.entity';
import { Reminder, ReminderType } from '../../entities/utilities/reminder.entity';
import { DataSource } from 'typeorm';
import dayjs from 'dayjs';

const DRUG_CATALOG_CACHE_TTL = 600; // 10 minutes (NF-01)
const DRUG_CATALOG_CACHE_KEY = 'drug_catalog_list';

@Injectable()
export class MedicationService {
  private readonly logger = new Logger(MedicationService.name);

  constructor(
    private readonly medicationRepo: MedicationRepository,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly consulService: ConsulService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectRepository(Reminder)
    private readonly reminderRepo: Repository<Reminder>,
  ) {}

  // =====================================================================
  // PUBLIC METHODS
  // =====================================================================

  /**
   * Add a new prescription for an elderly patient.
   *
   * CORE FLOW (Medication Safety — Priority #1):
   * 1. Validate DTO (dosage missing without unknownDosage flag → 422)
   * 2. If isGenericReminder → bypass all checks, set requireDisclaimer=true
   * 3. Fetch active drugs for the elderly from DB
   * 4. Call Drug Interaction API for each non-generic item
   * 5. If HIGH risk → throw 400 with warning details
   * 6. If safe → save Prescription + Items + Reminders in a DB transaction
   */
  async createPrescription(
    dto: CreatePrescriptionDto,
    createdByUserId: string,
  ): Promise<Prescription> {
    // --- Step 0: Pre-validate items ---
    this.validatePrescriptionItems(dto.items);

    // --- Step 1: Separate generic reminders from real drugs ---
    const genericItems = dto.items.filter((i) => i.isGenericReminder);
    const realDrugItems = dto.items.filter((i) => !i.isGenericReminder);

    // --- Step 2: Drug Interaction Check for real drug items ---
    if (realDrugItems.length > 0) {
      await this.runDrugInteractionCheck(dto.elderlyId, realDrugItems, createdByUserId);
    }

    // --- Step 3: Persist everything in a single DB Transaction (NF-03 ACID) ---
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Build prescription entity
      const prescription: Partial<Prescription> = {
        elderlyId: dto.elderlyId,
        prescriptionNumber: dto.prescriptionNumber,
        doctorName: dto.doctorName,
        hospitalName: dto.hospitalName,
        prescribedDate: dto.prescribedDate ? new Date(dto.prescribedDate) : undefined,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        source: dto.source,
        diagnosis: dto.diagnosis,
        notes: dto.notes,
        createdBy: createdByUserId,
      };

      const savedPrescription = await qr.manager.save(Prescription, prescription);

      // Build & save prescription items
      const itemEntities: Partial<PrescriptionItem>[] = dto.items.map((item) =>
        this.buildPrescriptionItemEntity(savedPrescription.id, item),
      );
      const savedItems = await qr.manager.save(PrescriptionItem, itemEntities);

      // Auto-create Reminders for active scheduled items (NF-03)
      const reminders = this.buildReminders(dto.elderlyId, savedItems, savedPrescription.startDate);
      if (reminders.length > 0) {
        await qr.manager.save(Reminder, reminders);
      }

      await qr.commitTransaction();

      this.logger.log(
        `Prescription [${savedPrescription.id}] created for elderly [${dto.elderlyId}] with ${savedItems.length} items and ${reminders.length} reminders.`,
      );

      // Invalidate cache for this elderly's active drugs
      await this.cacheManager.del(`active_drugs_${dto.elderlyId}`);

      return this.medicationRepo.findPrescriptionById(savedPrescription.id);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async updatePrescription(
    id: string,
    dto: UpdatePrescriptionDto,
    updatedByUserId: string,
  ): Promise<Prescription> {
    const existing = await this.medicationRepo.findPrescriptionById(id);
    if (!existing) {
      throw new NotFoundException(`Prescription [${id}] not found.`);
    }

    // Re-run Drug Interaction check if items changed
    if (dto.items && dto.items.length > 0) {
      this.validatePrescriptionItems(dto.items);
      const realDrugItems = dto.items.filter((i) => !i.isGenericReminder);
      if (realDrugItems.length > 0) {
        await this.runDrugInteractionCheck(existing.elderlyId, realDrugItems, updatedByUserId);
      }
    }

    return this.medicationRepo.updatePrescription(id, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : existing.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : existing.endDate,
    } as Partial<Prescription>);
  }

  async getPrescriptionById(id: string): Promise<Prescription> {
    const prescription = await this.medicationRepo.findPrescriptionById(id);
    if (!prescription) {
      throw new NotFoundException(`Prescription [${id}] not found.`);
    }
    return prescription;
  }

  async getPrescriptionsByElderly(
    elderlyId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Prescription[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.medicationRepo.findPrescriptionsByElderlyId(
      elderlyId,
      page,
      limit,
    );
    return { data, total, page, limit };
  }

  async deletePrescription(id: string): Promise<void> {
    const prescription = await this.medicationRepo.findPrescriptionById(id);
    if (!prescription) {
      throw new NotFoundException(`Prescription [${id}] not found.`);
    }
    await this.medicationRepo.softDeletePrescription(id);
  }

  /**
   * Drug catalog search with Redis cache (NF-01 Performance).
   */
  async searchDrugs(query: string, limit = 20) {
    const cacheKey = `drug_search_${query}_${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const results = await this.medicationRepo.searchDrugs(query, limit);
    await this.cacheManager.set(cacheKey, results, DRUG_CATALOG_CACHE_TTL);
    return results;
  }

  // =====================================================================
  // CORE BUSINESS LOGIC — PRIVATE METHODS
  // =====================================================================

  /**
   * BUSINESS RULE — Validate items before processing:
   * If dosage is absent AND unknownDosage is NOT true AND isGenericReminder is NOT true
   * → throw HTTP 422 UnprocessableEntityException (force frontend to collect manual input)
   */
  private validatePrescriptionItems(items: CreatePrescriptionItemDto[]): void {
    for (const item of items) {
      if (item.isGenericReminder) continue; // generic reminders bypass all validation

      if (
        (item.dosage === undefined || item.dosage === null) &&
        !item.unknownDosage
      ) {
        throw new UnprocessableEntityException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'Unprocessable Entity',
          message:
            `Dosage is required for drug "${item.drugNameRaw || item.drugId}". ` +
            `If the dosage cannot be determined (e.g. OCR failure), set unknownDosage=true ` +
            `to allow manual entry by the user.`,
          field: 'dosage',
          drugRef: item.drugNameRaw || item.drugId,
        });
      }
    }
  }

  /**
   * CORE SAFETY FLOW — Drug Interaction Check:
   *
   * Step 1: Get current active drugs of the elderly from DB (with Redis cache).
   * Step 2: For each new drug item, call Drug Interaction API against all active drugs.
   * Step 3: Parse response.
   *   - HIGH risk   → throw HTTP 400 with full interaction details (blocks prescription).
   *   - MODERATE    → log warning, allow to proceed.
   *   - LOW / NONE  → proceed silently.
   *
   * Note: unknownDosage items STILL go through this check (only overdose warning is bypassed).
   */
  private async runDrugInteractionCheck(
    elderlyId: string,
    newItems: CreatePrescriptionItemDto[],
    checkedByUserId: string,
  ): Promise<void> {
    // Step 1: Get active drugs (cached)
    const cacheKey = `active_drugs_${elderlyId}`;
    let activeDrugs = await this.cacheManager.get<any[]>(cacheKey);

    if (!activeDrugs) {
      const activeItems = await this.medicationRepo.findActiveDrugsByElderlyId(elderlyId);
      activeDrugs = activeItems
        .filter((i) => i.drug)
        .map((i) => ({
          drugId: i.drugId,
          name: i.drug?.genericName || i.drugNameRaw,
          rxnormCode: i.drug?.rxnormCode,
          atcCode: i.drug?.atcCode,
        }));
      await this.cacheManager.set(cacheKey, activeDrugs, 60); // short TTL for active drugs
    }

    if (!activeDrugs || activeDrugs.length === 0) {
      this.logger.debug(`No active drugs for elderly [${elderlyId}]. Skipping interaction check.`);
      return;
    }

    const highRiskInteractions: DrugInteractionResult[] = [];
    const allInteractions: DrugInteractionResult[] = [];

    // Step 2: For each new drug, check against all active drugs
    for (const newItem of newItems) {
      const newDrugName = newItem.drugNameRaw || newItem.drugId;

      for (const existingDrug of activeDrugs) {
        // Skip self-interaction check (same drug update scenario)
        if (existingDrug.drugId && existingDrug.drugId === newItem.drugId) continue;

        let interactionResult: DrugInteractionResult;

        try {
          interactionResult = await this.callDrugInteractionApi(
            newItem,
            existingDrug,
          );
        } catch (apiErr) {
          // API failure: log error but DO NOT block prescription (fail-open strategy)
          this.logger.error(
            `Drug Interaction API failed for ${newDrugName} vs ${existingDrug.name}: ${apiErr.message}`,
          );
          await this.medicationRepo.saveInteractionLog({
            elderlyId,
            newDrugId: newItem.drugId,
            newDrugName,
            existingDrugId: existingDrug.drugId,
            existingDrugName: existingDrug.name,
            severity: InteractionSeverity.NONE,
            checkStatus: InteractionCheckStatus.ERROR,
            checkedBy: checkedByUserId,
            checkedAt: new Date(),
            apiRawResponse: { error: apiErr.message },
          });
          continue;
        }

        allInteractions.push(interactionResult);

        // Step 3: Save interaction log
        const checkStatus =
          interactionResult.severity === InteractionSeverity.HIGH
            ? InteractionCheckStatus.BLOCKED
            : interactionResult.severity === InteractionSeverity.MODERATE
            ? InteractionCheckStatus.WARNED
            : InteractionCheckStatus.PASSED;

        await this.medicationRepo.saveInteractionLog({
          elderlyId,
          newDrugId: newItem.drugId,
          newDrugName,
          existingDrugId: existingDrug.drugId,
          existingDrugName: existingDrug.name,
          severity: interactionResult.severity,
          checkStatus,
          interactionDescription: interactionResult.description,
          clinicalEffects: interactionResult.clinicalEffects,
          apiRawResponse: interactionResult.rawResponse,
          apiSource: interactionResult.source,
          checkedBy: checkedByUserId,
          checkedAt: new Date(),
        });

        if (interactionResult.severity === InteractionSeverity.HIGH) {
          highRiskInteractions.push(interactionResult);
        }
      }
    }

    // Step 3 (cont.): HIGH risk → block prescription with HTTP 400
    if (highRiskInteractions.length > 0) {
      const warningMessages = highRiskInteractions.map(
        (i) =>
          `HIGH RISK: "${i.drugA}" + "${i.drugB}" — ${i.description || 'Dangerous interaction detected.'}`,
      );

      this.logger.warn(
        `Prescription BLOCKED for elderly [${elderlyId}] due to HIGH risk drug interactions: ${warningMessages.join('; ')}`,
      );

      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Drug Interaction Alert',
        message:
          'Prescription blocked due to HIGH RISK drug interactions. Please consult a physician.',
        interactions: highRiskInteractions,
        warnings: warningMessages,
      });
    }

    if (allInteractions.some((i) => i.severity === InteractionSeverity.MODERATE)) {
      this.logger.warn(
        `MODERATE risk interactions detected for elderly [${elderlyId}]. Proceeding with caution.`,
      );
    }
  }

  /**
   * Call the third-party/internal Drug Interaction API.
   * Uses Consul to discover the service endpoint dynamically.
   * Falls back to environment variable URL if Consul is unavailable.
   */
  private async callDrugInteractionApi(
    newItem: CreatePrescriptionItemDto,
    existingDrug: { drugId?: string; name: string; rxnormCode?: string; atcCode?: string },
  ): Promise<DrugInteractionResult> {
    const apiBaseUrl = await this.consulService.getServiceUrl(
      'drug-interaction-service',
      this.configService.get<string>('DRUG_INTERACTION_API_URL'),
    );

    const timeoutMs = this.configService.get<number>('DRUG_INTERACTION_TIMEOUT_MS') || 5000;

    const payload = {
      drugA: {
        id: newItem.drugId,
        name: newItem.drugNameRaw,
      },
      drugB: {
        id: existingDrug.drugId,
        name: existingDrug.name,
        rxnormCode: existingDrug.rxnormCode,
        atcCode: existingDrug.atcCode,
      },
    };

    const response = await firstValueFrom(
      this.httpService
        .post(`${apiBaseUrl}/interactions/check`, payload, {
          headers: {
            'X-API-Key': this.configService.get<string>('DRUG_INTERACTION_API_KEY'),
            'Content-Type': 'application/json',
          },
        })
        .pipe(
          timeout(timeoutMs),
          catchError((err) => {
            throw new Error(`Drug Interaction API request failed: ${err.message}`);
          }),
        ),
    );

    const data = response.data;

    return {
      severity: this.mapApiSeverity(data.severity || data.interactionSeverity),
      drugA: newItem.drugNameRaw || newItem.drugId,
      drugB: existingDrug.name,
      description: data.description || data.interactionDescription,
      clinicalEffects: data.clinicalEffects || data.effects,
      source: data.source || 'DrugInteractionAPI',
      rawResponse: data,
    };
  }

  private mapApiSeverity(apiSeverity: string): InteractionSeverity {
    const normalized = (apiSeverity || '').toUpperCase();
    if (['HIGH', 'CONTRAINDICATED', 'MAJOR', 'SEVERE'].includes(normalized)) {
      return InteractionSeverity.HIGH;
    }
    if (['MODERATE', 'SIGNIFICANT', 'MEDIUM'].includes(normalized)) {
      return InteractionSeverity.MODERATE;
    }
    if (['LOW', 'MINOR', 'MINIMAL'].includes(normalized)) {
      return InteractionSeverity.LOW;
    }
    return InteractionSeverity.NONE;
  }

  private buildPrescriptionItemEntity(
    prescriptionId: string,
    dto: CreatePrescriptionItemDto,
  ): Partial<PrescriptionItem> {
    const isGeneric = dto.isGenericReminder === true;

    return {
      prescriptionId,
      drugId: dto.drugId,
      drugNameRaw: dto.drugNameRaw,
      dosage: isGeneric ? null : dto.dosage,
      dosageUnit: dto.dosageUnit,
      quantity: dto.quantity,
      frequency: dto.frequency,
      frequencyInterval: dto.frequencyInterval,
      scheduledTimes: dto.scheduledTimes,
      mealRelation: dto.mealRelation,
      durationDays: dto.durationDays,
      instructions: dto.instructions,
      unknownDosage: dto.unknownDosage ?? false,
      isGenericReminder: isGeneric,
      requireDisclaimer: isGeneric, // auto-set per business rules
      reminderImageUrl: dto.reminderImageUrl,
      isActive: true,
    };
  }

  /**
   * Auto-create Reminder records for each prescription item that has scheduled times.
   * Ensures medication adherence tracking. (NF-03 ACID — runs inside the same transaction)
   */
  private buildReminders(
    elderlyId: string,
    items: PrescriptionItem[],
    startDate: Date,
  ): Partial<Reminder>[] {
    const reminders: Partial<Reminder>[] = [];

    for (const item of items) {
      const times = item.scheduledTimes;
      if (!times || times.length === 0) continue;

      for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledAt = dayjs(startDate)
          .hour(hours)
          .minute(minutes)
          .second(0)
          .toDate();

        reminders.push({
          elderlyId,
          type: ReminderType.MEDICATION,
          title: item.isGenericReminder
            ? 'Nhắc uống thuốc (hình ảnh)'
            : `Nhắc uống: ${item.drugNameRaw || 'thuốc'}`,
          description: item.instructions,
          scheduledAt,
          prescriptionItemId: item.id,
          imageUrl: item.reminderImageUrl,
          caregiverNotify: true,
        });
      }
    }

    return reminders;
  }
}
