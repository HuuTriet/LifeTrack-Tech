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

export enum NotificationType {
  DRUG_INTERACTION_ALERT = 'DRUG_INTERACTION_ALERT',
  MEDICATION_REMINDER = 'MEDICATION_REMINDER',
  MEDICATION_MISSED = 'MEDICATION_MISSED',
  VITAL_SIGN_ALERT = 'VITAL_SIGN_ALERT',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  CAREGIVER_MESSAGE = 'CAREGIVER_MESSAGE',
  OVERDOSE_WARNING = 'OVERDOSE_WARNING',
}

export enum NotificationChannel {
  PUSH = 'PUSH',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('notifications')
@Index(['elderlyId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'elderly_id', nullable: true })
  elderlyId: string;

  @ManyToOne(() => Elderly, (elderly) => elderly.notifications, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  @Column({ name: 'recipient_user_id' })
  recipientUserId: string; // could be caregiver or elderly

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.IN_APP })
  channel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationPriority, default: NotificationPriority.MEDIUM })
  priority: NotificationPriority;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // extra context data

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt: Date;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ name: 'fcm_token', length: 500, nullable: true })
  fcmToken: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
