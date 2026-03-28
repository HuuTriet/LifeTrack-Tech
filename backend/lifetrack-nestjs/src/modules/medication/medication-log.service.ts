import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MedicationLog } from '../../entities/medication/medication-log.entity';

@Injectable()
export class MedicationLogService {
  constructor(
    @InjectRepository(MedicationLog)
    private readonly repo: Repository<MedicationLog>,
  ) {}

  async logTaken(
    elderlyId: string,
    prescriptionItemId: string,
    drugName: string,
    scheduledDate: string,
    scheduledTime: string,
    recordedBy: string,
    notes?: string,
  ): Promise<MedicationLog> {
    // Upsert: if log exists update it, otherwise create
    let log = await this.repo.findOne({
      where: { elderlyId, prescriptionItemId, scheduledDate: new Date(scheduledDate), scheduledTime },
    });
    if (log) {
      await this.repo.update(log.id, { status: 'TAKEN', takenAt: new Date(), notes, recordedBy });
      return this.repo.findOne({ where: { id: log.id } }) as any;
    }
    const newLog = this.repo.create({
      elderlyId,
      prescriptionItemId,
      drugName,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      status: 'TAKEN',
      takenAt: new Date(),
      notes,
      recordedBy,
    });
    return this.repo.save(newLog);
  }

  async logSkipped(
    elderlyId: string,
    prescriptionItemId: string,
    drugName: string,
    scheduledDate: string,
    scheduledTime: string,
    recordedBy: string,
    notes?: string,
  ): Promise<MedicationLog> {
    let log = await this.repo.findOne({
      where: { elderlyId, prescriptionItemId, scheduledDate: new Date(scheduledDate), scheduledTime },
    });
    if (log) {
      await this.repo.update(log.id, { status: 'SKIPPED', notes, recordedBy });
      return this.repo.findOne({ where: { id: log.id } }) as any;
    }
    const newLog = this.repo.create({
      elderlyId,
      prescriptionItemId,
      drugName,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      status: 'SKIPPED',
      notes,
      recordedBy,
    });
    return this.repo.save(newLog);
  }

  async getAdherenceByDate(elderlyId: string, date: string): Promise<MedicationLog[]> {
    return this.repo.find({
      where: { elderlyId, scheduledDate: new Date(date) },
      order: { scheduledTime: 'ASC' },
    });
  }

  async getAdherenceStats(elderlyId: string, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const logs = await this.repo.find({
      where: { elderlyId, scheduledDate: Between(from, new Date()) as any },
    });
    const total = logs.length;
    const taken = logs.filter(l => l.status === 'TAKEN').length;
    const skipped = logs.filter(l => l.status === 'SKIPPED').length;
    const pending = logs.filter(l => l.status === 'PENDING').length;
    return {
      period: `${days} days`,
      total,
      taken,
      skipped,
      pending,
      adherenceRate: total > 0 ? Math.round((taken / total) * 100) : 0,
    };
  }
}
