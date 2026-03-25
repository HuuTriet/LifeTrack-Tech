import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Elderly } from '../auth/elderly.entity';

export enum VitalSignStatus {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

@Entity('vital_signs')
@Index(['elderlyId', 'measuredAt'])
export class VitalSigns {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'elderly_id' })
  elderlyId: string;

  @ManyToOne(() => Elderly, (elderly) => elderly.vitalSigns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  // Blood Pressure
  @Column({ type: 'int', name: 'blood_pressure_systolic', nullable: true })
  bloodPressureSystolic: number; // mmHg

  @Column({ type: 'int', name: 'blood_pressure_diastolic', nullable: true })
  bloodPressureDiastolic: number; // mmHg

  // Heart Rate
  @Column({ type: 'int', name: 'heart_rate', nullable: true })
  heartRate: number; // bpm

  // Temperature
  @Column({
    type: 'decimal',
    precision: 4,
    scale: 1,
    name: 'temperature',
    nullable: true,
  })
  temperature: number; // Celsius

  // SpO2 (Blood Oxygen)
  @Column({ type: 'decimal', precision: 4, scale: 1, name: 'spo2', nullable: true })
  spo2: number; // percentage

  // Blood Sugar
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'blood_sugar',
    nullable: true,
  })
  bloodSugar: number; // mmol/L

  // Respiratory Rate
  @Column({ type: 'int', name: 'respiratory_rate', nullable: true })
  respiratoryRate: number; // breaths/min

  @Column({
    type: 'enum',
    enum: VitalSignStatus,
    default: VitalSignStatus.NORMAL,
  })
  status: VitalSignStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'recorded_by', nullable: true })
  recordedBy: string; // userId of caregiver/self

  @Column({ name: 'device_id', length: 100, nullable: true })
  deviceId: string; // IoT device identifier

  @Column({ name: 'measured_at', type: 'datetime' })
  measuredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
