import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { VitalSigns } from '../../entities/health/vital-signs.entity';
import { HealthMetric } from '../../entities/health/health-metric.entity';
import { Elderly } from '../../entities/auth/elderly.entity';
import { Prescription } from '../../entities/medication/prescription.entity';

export interface ReportQuery {
  elderlyId: string;
  from: string;
  to: string;
  format: 'json' | 'csv';
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(VitalSigns)
    private readonly vitalSignsRepo: Repository<VitalSigns>,
    @InjectRepository(HealthMetric)
    private readonly healthMetricRepo: Repository<HealthMetric>,
    @InjectRepository(Elderly)
    private readonly elderlyRepo: Repository<Elderly>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
  ) {}

  // ── UC-15: Generate Health Report ─────────────────────────────────────────

  async generateReport(query: ReportQuery, requestedBy: string) {
    const { elderlyId, from, to, format } = query;

    if (new Date(from) > new Date(to)) {
      throw new BadRequestException('Start date must be before end date.');
    }

    const elderly = await this.elderlyRepo.findOne({
      where: { id: elderlyId },
      relations: ['user'],
    });
    if (!elderly) throw new NotFoundException('Elderly profile not found.');

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const [vitals, metrics, prescriptions] = await Promise.all([
      this.vitalSignsRepo.find({
        where: { elderlyId, measuredAt: Between(fromDate, toDate) },
        order: { measuredAt: 'ASC' },
      }),
      this.healthMetricRepo.find({
        where: { elderlyId, recordedAt: Between(fromDate, toDate) },
        order: { recordedAt: 'ASC' },
      }),
      this.prescriptionRepo.find({
        where: { elderlyId },
        relations: ['items', 'items.drug'],
        order: { createdAt: 'DESC' },
      }),
    ]);

    const summary = this.buildSummary(vitals, metrics);
    const reportData = {
      generatedAt: new Date().toISOString(),
      generatedBy: requestedBy,
      patient: {
        id: elderly.id,
        name: elderly.user?.fullName,
        dateOfBirth: elderly.dateOfBirth,
        bloodType: elderly.bloodType,
        chronicConditions: elderly.chronicConditions,
        knownAllergies: elderly.knownAllergies,
      },
      period: { from, to },
      summary,
      vitalSigns: vitals,
      healthMetrics: metrics,
      activePrescriptions: prescriptions,
    };

    this.logger.log(
      `Health report generated for elderly ${elderlyId} by ${requestedBy} (${format})`,
    );

    if (format === 'csv') {
      return {
        contentType: 'text/csv',
        filename: `health-report-${elderlyId}-${from}-${to}.csv`,
        data: this.convertToCsv(vitals),
      };
    }

    return reportData;
  }

  private buildSummary(vitals: VitalSigns[], metrics: HealthMetric[]) {
    const hrValues = vitals.map((v) => v.heartRate).filter(Boolean) as number[];
    const spo2Values = vitals.map((v) => v.spo2).filter(Boolean) as number[];
    const bpSysValues = vitals.map((v) => v.bloodPressureSystolic).filter(Boolean) as number[];

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    return {
      totalVitalReadings: vitals.length,
      totalMetricReadings: metrics.length,
      criticalAlerts: vitals.filter((v) => v.status === 'CRITICAL').length,
      warningAlerts: vitals.filter((v) => v.status === 'WARNING').length,
      averageHeartRate: avg(hrValues),
      averageSpO2: avg(spo2Values),
      averageSystolicBP: avg(bpSysValues),
    };
  }

  private convertToCsv(vitals: VitalSigns[]): string {
    const headers = [
      'Date',
      'BP Systolic',
      'BP Diastolic',
      'Heart Rate',
      'Temperature',
      'SpO2',
      'Blood Sugar',
      'Status',
    ].join(',');

    const rows = vitals.map((v) =>
      [
        new Date(v.measuredAt).toISOString(),
        v.bloodPressureSystolic ?? '',
        v.bloodPressureDiastolic ?? '',
        v.heartRate ?? '',
        v.temperature ?? '',
        v.spo2 ?? '',
        v.bloodSugar ?? '',
        v.status,
      ].join(','),
    );

    return [headers, ...rows].join('\n');
  }
}
