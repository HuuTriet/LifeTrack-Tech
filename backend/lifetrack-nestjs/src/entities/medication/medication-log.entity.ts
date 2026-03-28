import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Elderly } from '../auth/elderly.entity';

@Entity('medication_logs')
export class MedicationLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'elderly_id' }) elderlyId: string;
  @ManyToOne(() => Elderly, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  // Stored as plain column to avoid multiple cascade path error in SQL Server
  @Column({ name: 'prescription_item_id', nullable: true }) prescriptionItemId: string;

  @Column({ name: 'drug_name', length: 255 }) drugName: string;
  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true }) dosage: number;
  @Column({ name: 'dosage_unit', length: 20, nullable: true }) dosageUnit: string;

  @Column({ name: 'scheduled_date', type: 'date' }) scheduledDate: Date;
  @Column({ name: 'scheduled_time', length: 10 }) scheduledTime: string; // "08:00"

  @Column({ type: 'nvarchar', length: 20, default: 'PENDING' }) status: string; // PENDING, TAKEN, SKIPPED, LATE
  @Column({ name: 'taken_at', type: 'datetime', nullable: true }) takenAt: Date;
  @Column({ type: 'text', nullable: true }) notes: string;

  @Column({ name: 'recorded_by', nullable: true }) recordedBy: string; // userId
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
