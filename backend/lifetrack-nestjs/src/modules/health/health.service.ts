import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { VitalSigns, VitalSignStatus } from '../../entities/health/vital-signs.entity';
import { HealthMetric, MetricTrend } from '../../entities/health/health-metric.entity';
import { Elderly } from '../../entities/auth/elderly.entity';
import {
  RecordVitalSignsDto,
  RecordHealthMetricDto,
  HealthTrendsQueryDto,
} from './dto/health.dto';

// BP thresholds (mmHg)
const BP_SYSTOLIC_CRITICAL_HIGH = 180;
const BP_SYSTOLIC_WARNING_HIGH = 140;
const BP_SYSTOLIC_WARNING_LOW = 90;
const BP_DIASTOLIC_CRITICAL_HIGH = 120;
const BP_DIASTOLIC_WARNING_HIGH = 90;
const BP_DIASTOLIC_WARNING_LOW = 60;
// Heart rate thresholds (bpm)
const HR_CRITICAL_HIGH = 150;
const HR_WARNING_HIGH = 100;
const HR_WARNING_LOW = 50;
// SpO2 thresholds (%)
const SPO2_CRITICAL_LOW = 90;
const SPO2_WARNING_LOW = 95;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectRepository(VitalSigns)
    private readonly vitalSignsRepo: Repository<VitalSigns>,
    @InjectRepository(HealthMetric)
    private readonly healthMetricRepo: Repository<HealthMetric>,
    @InjectRepository(Elderly)
    private readonly elderlyRepo: Repository<Elderly>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── UC-06: Record Vital Signs ─────────────────────────────────────────────

  async recordVitalSigns(
    elderlyId: string,
    dto: RecordVitalSignsDto,
    recordedBy: string,
  ) {
    await this.ensureElderlyExists(elderlyId);

    const status = this.computeVitalStatus(dto);

    const vital = this.vitalSignsRepo.create({
      elderlyId,
      bloodPressureSystolic: dto.bloodPressureSystolic,
      bloodPressureDiastolic: dto.bloodPressureDiastolic,
      heartRate: dto.heartRate,
      temperature: dto.temperature,
      spo2: dto.spo2,
      bloodSugar: dto.bloodSugar,
      respiratoryRate: dto.respiratoryRate,
      notes: dto.notes,
      recordedBy,
      measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(),
      status,
    });

    const saved = await this.vitalSignsRepo.save(vital);

    // Emit event for notification module to pick up (Observer pattern)
    if (status === VitalSignStatus.CRITICAL || status === VitalSignStatus.WARNING) {
      this.eventEmitter.emit('health.alert', {
        elderlyId,
        status,
        vitalSigns: saved,
        recordedBy,
      });
    }

    return saved;
  }

  // ── Latest Vital Signs ────────────────────────────────────────────────────

  async getLatestVitalSigns(elderlyId: string) {
    await this.ensureElderlyExists(elderlyId);
    return this.vitalSignsRepo.findOne({
      where: { elderlyId },
      order: { measuredAt: 'DESC' },
    });
  }

  // ── Vital Signs History ───────────────────────────────────────────────────

  async getVitalSignsHistory(
    elderlyId: string,
    query: HealthTrendsQueryDto,
  ) {
    await this.ensureElderlyExists(elderlyId);
    const { from, to } = this.resolveRange(query);

    return this.vitalSignsRepo.find({
      where: {
        elderlyId,
        measuredAt: Between(from, to),
      },
      order: { measuredAt: 'ASC' },
    });
  }

  // ── UC-07: Health Trends (aggregated chart data) ──────────────────────────

  async getHealthTrends(elderlyId: string, query: HealthTrendsQueryDto) {
    await this.ensureElderlyExists(elderlyId);
    const { from, to } = this.resolveRange(query);

    const vitals = await this.vitalSignsRepo.find({
      where: { elderlyId, measuredAt: Between(from, to) },
      order: { measuredAt: 'ASC' },
    });

    const metrics = await this.healthMetricRepo.find({
      where: { elderlyId, recordedAt: Between(from, to) },
      order: { recordedAt: 'ASC' },
    });

    // Build trend points for chart
    const trendData = vitals.map((v) => ({
      date: v.measuredAt,
      heartRate: v.heartRate,
      bloodPressureSystolic: v.bloodPressureSystolic,
      bloodPressureDiastolic: v.bloodPressureDiastolic,
      spo2: v.spo2,
      temperature: v.temperature,
      bloodSugar: v.bloodSugar,
      status: v.status,
    }));

    // Anomaly detection: flag points that deviate >2 std from mean
    const anomalies = this.detectAnomalies(vitals);

    return {
      range: { from, to },
      trendData,
      metrics,
      anomalies,
      summary: this.computeSummary(vitals),
    };
  }

  // ── UC-06: Record Health Metric ───────────────────────────────────────────

  async recordHealthMetric(
    elderlyId: string,
    dto: RecordHealthMetricDto,
  ) {
    await this.ensureElderlyExists(elderlyId);

    // Compute trend by comparing to last reading of same type
    const last = await this.healthMetricRepo.findOne({
      where: { elderlyId, metricType: dto.metricType },
      order: { recordedAt: 'DESC' },
    });

    let trend = MetricTrend.UNKNOWN;
    if (last) {
      const diff = dto.value - Number(last.value);
      // Simplified trend: positive diff = improving for most metrics
      if (Math.abs(diff) < 0.5) trend = MetricTrend.STABLE;
      else if (diff > 0) trend = MetricTrend.IMPROVING;
      else trend = MetricTrend.DECLINING;
    }

    const metric = this.healthMetricRepo.create({
      elderlyId,
      metricType: dto.metricType,
      value: dto.value,
      unit: dto.unit,
      trend,
      notes: dto.notes,
      recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
    });

    return this.healthMetricRepo.save(metric);
  }

  // ── Get all metrics for an elderly ────────────────────────────────────────

  async getHealthMetrics(elderlyId: string, query: HealthTrendsQueryDto) {
    await this.ensureElderlyExists(elderlyId);
    const { from, to } = this.resolveRange(query);

    return this.healthMetricRepo.find({
      where: { elderlyId, recordedAt: Between(from, to) },
      order: { recordedAt: 'DESC' },
    });
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private computeVitalStatus(dto: RecordVitalSignsDto): VitalSignStatus {
    const isCritical =
      (dto.bloodPressureSystolic !== undefined &&
        (dto.bloodPressureSystolic >= BP_SYSTOLIC_CRITICAL_HIGH ||
          dto.bloodPressureSystolic < BP_SYSTOLIC_WARNING_LOW)) ||
      (dto.bloodPressureDiastolic !== undefined &&
        dto.bloodPressureDiastolic >= BP_DIASTOLIC_CRITICAL_HIGH) ||
      (dto.heartRate !== undefined &&
        (dto.heartRate >= HR_CRITICAL_HIGH || dto.heartRate < HR_WARNING_LOW)) ||
      (dto.spo2 !== undefined && dto.spo2 < SPO2_CRITICAL_LOW);

    const isWarning =
      !isCritical &&
      ((dto.bloodPressureSystolic !== undefined &&
        dto.bloodPressureSystolic >= BP_SYSTOLIC_WARNING_HIGH) ||
        (dto.bloodPressureDiastolic !== undefined &&
          dto.bloodPressureDiastolic >= BP_DIASTOLIC_WARNING_HIGH) ||
        (dto.heartRate !== undefined &&
          (dto.heartRate >= HR_WARNING_HIGH || dto.heartRate <= HR_WARNING_LOW + 10)) ||
        (dto.spo2 !== undefined && dto.spo2 < SPO2_WARNING_LOW));

    if (isCritical) return VitalSignStatus.CRITICAL;
    if (isWarning) return VitalSignStatus.WARNING;
    return VitalSignStatus.NORMAL;
  }

  private resolveRange(query: HealthTrendsQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    let from: Date;

    if (query.from) {
      from = new Date(query.from);
    } else {
      const days =
        query.range === '7d'
          ? 7
          : query.range === '90d'
          ? 90
          : query.range === '1y'
          ? 365
          : 30;
      from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    return { from, to };
  }

  private detectAnomalies(vitals: VitalSigns[]) {
    if (vitals.length < 3) return [];

    const hrValues = vitals.map((v) => v.heartRate).filter(Boolean) as number[];
    if (hrValues.length === 0) return [];

    const mean = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
    const variance = hrValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hrValues.length;
    const std = Math.sqrt(variance);
    const threshold = 2 * std;

    return vitals
      .filter((v) => v.heartRate && Math.abs(v.heartRate - mean) > threshold)
      .map((v) => ({
        date: v.measuredAt,
        field: 'heartRate',
        value: v.heartRate,
        mean: Math.round(mean),
        deviation: Math.round(Math.abs(v.heartRate! - mean)),
      }));
  }

  private computeSummary(vitals: VitalSigns[]) {
    const criticalCount = vitals.filter((v) => v.status === VitalSignStatus.CRITICAL).length;
    const warningCount = vitals.filter((v) => v.status === VitalSignStatus.WARNING).length;
    const hrValues = vitals.map((v) => v.heartRate).filter(Boolean) as number[];
    const avgHr = hrValues.length
      ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
      : null;

    return {
      totalReadings: vitals.length,
      criticalCount,
      warningCount,
      normalCount: vitals.length - criticalCount - warningCount,
      averageHeartRate: avgHr,
    };
  }

  private async ensureElderlyExists(elderlyId: string) {
    const elderly = await this.elderlyRepo.findOne({ where: { id: elderlyId } });
    if (!elderly) throw new NotFoundException(`Elderly profile ${elderlyId} not found.`);
    return elderly;
  }
}
