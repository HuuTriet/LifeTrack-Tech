import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MedicationLog } from '../../entities/medication/medication-log.entity';
import { Prescription } from '../../entities/medication/prescription.entity';
import { PrescriptionItem } from '../../entities/medication/prescription-item.entity';

@Injectable()
export class MedicationLogService {
  constructor(
    @InjectRepository(MedicationLog)
    private readonly repo: Repository<MedicationLog>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
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

  /**
   * Returns today's medication schedule by merging:
   * 1. Existing logs (TAKEN / SKIPPED) stored in the DB
   * 2. Pending slots derived from active prescriptions that have no log yet
   */
  async getAdherenceByDate(elderlyId: string, date: string): Promise<any[]> {
    const targetDate = new Date(date);
    const dateStr = date; // YYYY-MM-DD

    // 1. Fetch existing logs for this date
    const existingLogs = await this.repo.find({
      where: { elderlyId, scheduledDate: targetDate },
      order: { scheduledTime: 'ASC' },
    });

    const loggedKeys = new Set(
      existingLogs.map(l => `${l.prescriptionItemId}::${l.scheduledTime}`),
    );

    // 2. Fetch active prescriptions covering this date
    const prescriptions = await this.prescriptionRepo.find({
      where: { elderlyId, status: 'ACTIVE' as any },
      relations: ['items'],
    });

    const pendingSlots: any[] = [];

    for (const rx of prescriptions) {
      const start = rx.startDate ? new Date(rx.startDate) : null;
      const end = rx.endDate ? new Date(rx.endDate) : null;

      // Check date range
      if (start && targetDate < new Date(start.toISOString().split('T')[0])) continue;
      if (end && targetDate > new Date(end.toISOString().split('T')[0])) continue;

      for (const item of (rx.items || []) as PrescriptionItem[]) {
        if (!item.isActive) continue;
        const times: string[] = Array.isArray(item.scheduledTimes) ? item.scheduledTimes : [];
        if (times.length === 0) continue;

        const drugName = item.drugNameRaw || (item as any).drug?.genericName || 'Thuốc';

        for (const time of times) {
          const key = `${item.id}::${time}`;
          if (loggedKeys.has(key)) continue; // already has a log

          pendingSlots.push({
            id: `pending-${item.id}-${time}`,
            elderlyId,
            prescriptionItemId: item.id,
            drugName,
            scheduledDate: dateStr,
            scheduledTime: time,
            status: 'PENDING',
            takenAt: null,
            notes: item.instructions || null,
            recordedBy: null,
          });
        }
      }
    }

    // 3. Merge: existing logs + pending, sorted by time
    const all = [
      ...existingLogs.map(l => ({
        ...l,
        scheduledDate: dateStr,
      })),
      ...pendingSlots,
    ].sort((a, b) => (a.scheduledTime > b.scheduledTime ? 1 : -1));

    return all;
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
