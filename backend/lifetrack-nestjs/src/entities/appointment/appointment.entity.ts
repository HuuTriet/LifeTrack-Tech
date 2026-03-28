import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Elderly } from '../auth/elderly.entity';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'elderly_id' }) elderlyId: string;
  @ManyToOne(() => Elderly, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  @Column({ name: 'doctor_name', length: 200 }) doctorName: string;
  @Column({ length: 150, nullable: true }) specialty: string;
  @Column({ name: 'hospital_name', length: 255, nullable: true }) hospitalName: string;
  @Column({ name: 'hospital_address', length: 500, nullable: true }) hospitalAddress: string;
  @Column({ name: 'appointment_date', type: 'datetime' }) appointmentDate: Date;
  @Column({ name: 'duration_minutes', type: 'int', default: 30 }) durationMinutes: number;
  @Column({ type: 'nvarchar', length: 20, default: 'SCHEDULED' }) status: string; // SCHEDULED, COMPLETED, CANCELLED, NO_SHOW
  @Column({ type: 'nvarchar', length: 20, default: 'CLINIC', name: 'appointment_type' }) appointmentType: string; // CLINIC, TELEMEDICINE, HOME_VISIT
  @Column({ type: 'text', nullable: true }) reason: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ type: 'text', name: 'doctor_notes', nullable: true }) doctorNotes: string;
  @Column({ name: 'reminder_sent', default: false }) reminderSent: boolean;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
