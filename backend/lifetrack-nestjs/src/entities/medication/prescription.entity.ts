import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Elderly } from '../auth/elderly.entity';
import { PrescriptionItem } from './prescription-item.entity';

export enum PrescriptionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
}

export enum PrescriptionSource {
  DOCTOR = 'DOCTOR',
  OCR_SCAN = 'OCR_SCAN',
  MANUAL = 'MANUAL',
  CAREGIVER = 'CAREGIVER',
}

@Entity('prescriptions')
@Index(['elderlyId', 'status'])
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'elderly_id' })
  elderlyId: string;

  @ManyToOne(() => Elderly, (elderly) => elderly.prescriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  @Column({ length: 100, name: 'prescription_number', nullable: true })
  prescriptionNumber: string;

  @Column({ length: 200, name: 'doctor_name', nullable: true })
  doctorName: string;

  @Column({ length: 200, name: 'hospital_name', nullable: true })
  hospitalName: string;

  @Column({ type: 'date', name: 'prescribed_date', nullable: true })
  prescribedDate: Date;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.ACTIVE,
  })
  status: PrescriptionStatus;

  @Column({
    type: 'enum',
    enum: PrescriptionSource,
    default: PrescriptionSource.MANUAL,
  })
  source: PrescriptionSource;

  @Column({ type: 'text', name: 'diagnosis', nullable: true })
  diagnosis: string;

  @Column({ type: 'text', notes: 'notes', nullable: true })
  notes: string;

  // OCR metadata
  @Column({ name: 'ocr_image_url', length: 500, nullable: true })
  ocrImageUrl: string;

  @Column({ name: 'ocr_confidence_score', type: 'decimal', precision: 5, scale: 4, nullable: true })
  ocrConfidenceScore: number;

  @Column({ name: 'ocr_raw_text', type: 'text', nullable: true })
  ocrRawText: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string; // userId

  @OneToMany(() => PrescriptionItem, (item) => item.prescription, {
    cascade: true,
    eager: true,
  })
  items: PrescriptionItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
