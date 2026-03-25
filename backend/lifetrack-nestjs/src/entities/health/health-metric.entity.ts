import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Elderly } from '../auth/elderly.entity';

export enum MetricType {
  WEIGHT = 'WEIGHT',
  BMI = 'BMI',
  WAIST_CIRCUMFERENCE = 'WAIST_CIRCUMFERENCE',
  SLEEP_DURATION = 'SLEEP_DURATION',
  STEPS_COUNT = 'STEPS_COUNT',
  CALORIES_BURNED = 'CALORIES_BURNED',
  WATER_INTAKE = 'WATER_INTAKE',
  PAIN_LEVEL = 'PAIN_LEVEL',
  MOOD_SCORE = 'MOOD_SCORE',
  COGNITIVE_SCORE = 'COGNITIVE_SCORE',
}

export enum MetricTrend {
  IMPROVING = 'IMPROVING',
  STABLE = 'STABLE',
  DECLINING = 'DECLINING',
  UNKNOWN = 'UNKNOWN',
}

@Entity('health_metrics')
@Index(['elderlyId', 'metricType', 'recordedAt'])
export class HealthMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'elderly_id' })
  elderlyId: string;

  @ManyToOne(() => Elderly, (elderly) => elderly.healthMetrics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  @Column({ type: 'enum', enum: MetricType, name: 'metric_type' })
  metricType: MetricType;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  value: number;

  @Column({ length: 20 })
  unit: string; // kg, bpm, hours, steps, etc.

  @Column({
    type: 'enum',
    enum: MetricTrend,
    default: MetricTrend.UNKNOWN,
  })
  trend: MetricTrend;

  @Column({ name: 'target_min', type: 'decimal', precision: 10, scale: 3, nullable: true })
  targetMin: number;

  @Column({ name: 'target_max', type: 'decimal', precision: 10, scale: 3, nullable: true })
  targetMax: number;

  @Column({ name: 'is_within_target', nullable: true })
  isWithinTarget: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'recorded_at', type: 'datetime' })
  recordedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
