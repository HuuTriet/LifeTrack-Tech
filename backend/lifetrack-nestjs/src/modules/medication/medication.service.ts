import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { MedicationRepository } from './medication.repository';
import { CreatePrescriptionDto, CreatePrescriptionItemDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

import { Prescription } from '../../entities/medication/prescription.entity';
import { PrescriptionItem } from '../../entities/medication/prescription-item.entity';
import { Reminder, ReminderType } from '../../entities/utilities/reminder.entity';
import { DataSource } from 'typeorm';
import dayjs from 'dayjs';

const DRUG_CATALOG_CACHE_TTL = 600; // 10 minutes

@Injectable()
export class MedicationService {
  private readonly logger = new Logger(MedicationService.name);

  constructor(
    private readonly medicationRepo: MedicationRepository,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // =====================================================================
  // PUBLIC METHODS
  // =====================================================================

  async createPrescription(
    dto: CreatePrescriptionDto,
    createdByUserId: string,
  ): Promise<Prescription> {
    this.validatePrescriptionItems(dto.items);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
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

      const itemEntities: Partial<PrescriptionItem>[] = dto.items.map((item) =>
        this.buildPrescriptionItemEntity(savedPrescription.id, item),
      );
      const savedItems = await qr.manager.save(PrescriptionItem, itemEntities);

      const reminders = this.buildReminders(dto.elderlyId, savedItems, savedPrescription.startDate);
      if (reminders.length > 0) {
        await qr.manager.save(Reminder, reminders);
      }

      await qr.commitTransaction();

      this.logger.log(
        `Prescription [${savedPrescription.id}] created for elderly [${dto.elderlyId}] with ${savedItems.length} items.`,
      );

      await this.cacheManager.del(`active_drugs_${dto.elderlyId}`);

      return this.medicationRepo.findPrescriptionById(savedPrescription.id) as any;
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

    if (dto.items && dto.items.length > 0) {
      this.validatePrescriptionItems(dto.items);
    }

    return this.medicationRepo.updatePrescription(id, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : existing.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : existing.endDate,
      prescribedDate: dto.prescribedDate ? new Date(dto.prescribedDate) : existing.prescribedDate,
    } as unknown as Partial<Prescription>);
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

  async searchDrugs(query: string, limit = 20) {
    const cacheKey = `drug_search_${query}_${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const results = await this.medicationRepo.searchDrugs(query, limit);
    await this.cacheManager.set(cacheKey, results, DRUG_CATALOG_CACHE_TTL);
    return results;
  }

  // =====================================================================
  // PRIVATE HELPERS
  // =====================================================================

  private validatePrescriptionItems(items: CreatePrescriptionItemDto[]): void {
    for (const item of items) {
      if (item.isGenericReminder) continue;
      if ((item.dosage === undefined || item.dosage === null) && !item.unknownDosage) {
        throw new UnprocessableEntityException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'Unprocessable Entity',
          message:
            `Dosage is required for drug "${item.drugNameRaw || item.drugId}". ` +
            `If the dosage cannot be determined, set unknownDosage=true.`,
          field: 'dosage',
          drugRef: item.drugNameRaw || item.drugId,
        });
      }
    }
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
      dosage: isGeneric ? undefined : dto.dosage,
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
      requireDisclaimer: isGeneric,
      reminderImageUrl: dto.reminderImageUrl,
      isActive: true,
    };
  }

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
