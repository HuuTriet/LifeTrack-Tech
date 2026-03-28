import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  JoinColumn,
  OneToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from './user.entity';
import { Prescription } from '../medication/prescription.entity';
import { VitalSigns } from '../health/vital-signs.entity';
import { HealthMetric } from '../health/health-metric.entity';
import { Reminder } from '../utilities/reminder.entity';
import { Notification } from '../utilities/notification.entity';

export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
  UNKNOWN = 'UNKNOWN',
}

@Entity('elderly_profiles')
export class Elderly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'date', name: 'date_of_birth', nullable: true })
  dateOfBirth: Date;

  @Column({ length: 10, nullable: true })
  gender: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number; // kg

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  height: number; // cm

  @Column({ type: 'nvarchar', length: 10, default: BloodType.UNKNOWN, name: 'blood_type' })
  bloodType: BloodType;

  @Column({ type: 'text', name: 'known_allergies', nullable: true })
  knownAllergies: string; // comma-separated or JSON string

  @Column({ type: 'text', name: 'chronic_conditions', nullable: true })
  chronicConditions: string;

  @Column({ length: 255, name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ length: 50, name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone: string;

  @Column({ name: 'caregiver_id', nullable: true })
  caregiverId: string;

  @Column({ name: 'room_number', length: 20, nullable: true })
  roomNumber: string;

  @OneToMany(() => Prescription, (prescription) => prescription.elderly, {
    cascade: true,
  })
  prescriptions: Prescription[];

  @OneToMany(() => VitalSigns, (v) => v.elderly, { cascade: true })
  vitalSigns: VitalSigns[];

  @OneToMany(() => HealthMetric, (m) => m.elderly, { cascade: true })
  healthMetrics: HealthMetric[];

  @OneToMany(() => Reminder, (r) => r.elderly, { cascade: true })
  reminders: Reminder[];

  @OneToMany(() => Notification, (n) => n.elderly, { cascade: true })
  notifications: Notification[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
