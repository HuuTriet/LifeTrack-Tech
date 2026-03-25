import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Prescription } from '../../entities/medication/prescription.entity';
import { PrescriptionItem } from '../../entities/medication/prescription-item.entity';
import { Drug } from '../../entities/medication/drug.entity';
import { InteractionLog } from '../../entities/medication/interaction-log.entity';

@Injectable()
export class MedicationRepository {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private readonly itemRepo: Repository<PrescriptionItem>,
    @InjectRepository(Drug)
    private readonly drugRepo: Repository<Drug>,
    @InjectRepository(InteractionLog)
    private readonly interactionLogRepo: Repository<InteractionLog>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Fetch all active prescription items for an elderly profile.
   * Used as Step 1 of the Drug Interaction safety check.
   */
  async findActiveDrugsByElderlyId(elderlyId: string): Promise<PrescriptionItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.prescription', 'prescription')
      .leftJoinAndSelect('item.drug', 'drug')
      .where('prescription.elderly_id = :elderlyId', { elderlyId })
      .andWhere('prescription.status = :status', { status: 'ACTIVE' })
      .andWhere('item.is_active = :active', { active: true })
      .andWhere('item.is_generic_reminder = :generic', { generic: false })
      .getMany();
  }

  async findPrescriptionById(id: string): Promise<Prescription | null> {
    return this.prescriptionRepo.findOne({
      where: { id },
      relations: ['items', 'items.drug', 'elderly'],
    });
  }

  async findPrescriptionsByElderlyId(
    elderlyId: string,
    page: number,
    limit: number,
  ): Promise<[Prescription[], number]> {
    return this.prescriptionRepo.findAndCount({
      where: { elderlyId },
      relations: ['items', 'items.drug'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findDrugById(id: string): Promise<Drug | null> {
    return this.drugRepo.findOne({ where: { id, isActive: true } });
  }

  async findDrugByName(name: string): Promise<Drug | null> {
    return this.drugRepo
      .createQueryBuilder('drug')
      .where('LOWER(drug.genericName) = LOWER(:name)', { name })
      .orWhere('LOWER(drug.brandName) = LOWER(:name)', { name })
      .andWhere('drug.isActive = :active', { active: true })
      .getOne();
  }

  async searchDrugs(query: string, limit = 20): Promise<Drug[]> {
    return this.drugRepo
      .createQueryBuilder('drug')
      .where('drug.genericName LIKE :q OR drug.brandName LIKE :q', {
        q: `%${query}%`,
      })
      .andWhere('drug.isActive = :active', { active: true })
      .take(limit)
      .getMany();
  }

  /** Save prescription + items inside a single DB transaction (NF-03 ACID) */
  async savePrescriptionWithItems(
    prescription: Partial<Prescription>,
    items: Partial<PrescriptionItem>[],
    queryRunner?: QueryRunner,
  ): Promise<Prescription> {
    const qr = queryRunner ?? this.dataSource.createQueryRunner();
    const ownTransaction = !queryRunner;

    if (ownTransaction) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      const savedPrescription = await qr.manager.save(Prescription, prescription);
      const itemsWithPrescriptionId = items.map((item) => ({
        ...item,
        prescriptionId: savedPrescription.id,
      }));
      await qr.manager.save(PrescriptionItem, itemsWithPrescriptionId);

      if (ownTransaction) {
        await qr.commitTransaction();
      }

      return this.prescriptionRepo.findOne({
        where: { id: savedPrescription.id },
        relations: ['items', 'items.drug'],
      });
    } catch (err) {
      if (ownTransaction) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      if (ownTransaction) {
        await qr.release();
      }
    }
  }

  async saveInteractionLog(log: Partial<InteractionLog>): Promise<InteractionLog> {
    return this.interactionLogRepo.save(log);
  }

  async updatePrescription(
    id: string,
    data: Partial<Prescription>,
  ): Promise<Prescription> {
    await this.prescriptionRepo.update(id, data);
    return this.findPrescriptionById(id);
  }

  async softDeletePrescription(id: string): Promise<void> {
    await this.prescriptionRepo.softDelete(id);
  }
}
