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

export enum ReminderType {
  MEDICATION = 'MEDICATION',
  APPOINTMENT = 'APPOINTMENT',
  VITAL_CHECK = 'VITAL_CHECK',
  EXERCISE = 'EXERCISE',
  HYDRATION = 'HYDRATION',
  GENERIC = 'GENERIC',
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  MISSED = 'MISSED',
  SNOOZED = 'SNOOZED',
  CANCELLED = 'CANCELLED',
}

export enum ReminderRepeat {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

@Entity('reminders')
@Index(['elderlyId', 'scheduledAt', 'status'])
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'elderly_id' })
  elderlyId: string;

  @ManyToOne(() => Elderly, (elderly) => elderly.reminders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  @Column({ type: 'enum', enum: ReminderType, default: ReminderType.MEDICATION })
  type: ReminderType;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ReminderStatus, default: ReminderStatus.PENDING })
  status: ReminderStatus;

  @Column({ type: 'enum', enum: ReminderRepeat, default: ReminderRepeat.NONE })
  repeat: ReminderRepeat;

  @Column({ type: 'json', name: 'repeat_days', nullable: true })
  repeatDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat

  @Column({ name: 'scheduled_at', type: 'datetime' })
  scheduledAt: Date;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ name: 'acknowledged_at', type: 'datetime', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'snoozed_until', type: 'datetime', nullable: true })
  snoozedUntil: Date;

  // Link to prescription item if MEDICATION type
  @Column({ name: 'prescription_item_id', nullable: true })
  prescriptionItemId: string;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl: string; // for generic medication reminders

  @Column({ name: 'sound_enabled', default: true })
  soundEnabled: boolean;

  @Column({ name: 'vibration_enabled', default: true })
  vibrationEnabled: boolean;

  @Column({ name: 'caregiver_notify', default: false })
  caregiverNotify: boolean; // notify caregiver if missed

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
