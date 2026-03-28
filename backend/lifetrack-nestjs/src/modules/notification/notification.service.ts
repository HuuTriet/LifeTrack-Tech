import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';

import {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from '../../entities/utilities/notification.entity';
import { VitalSignStatus } from '../../entities/health/vital-signs.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  // ── UC-14: Observer — health.alert event handler ──────────────────────────

  @OnEvent('health.alert')
  async handleHealthAlert(payload: {
    elderlyId: string;
    status: VitalSignStatus;
    vitalSigns: any;
    recordedBy: string;
  }) {
    const isCritical = payload.status === VitalSignStatus.CRITICAL;
    const priority = isCritical
      ? NotificationPriority.CRITICAL
      : NotificationPriority.HIGH;

    const title = isCritical
      ? '🚨 Critical Vital Sign Alert'
      : '⚠️ Abnormal Vital Sign Detected';

    const vs = payload.vitalSigns;
    const details: string[] = [];
    if (vs.bloodPressureSystolic)
      details.push(`BP: ${vs.bloodPressureSystolic}/${vs.bloodPressureDiastolic} mmHg`);
    if (vs.heartRate) details.push(`HR: ${vs.heartRate} bpm`);
    if (vs.spo2) details.push(`SpO2: ${vs.spo2}%`);

    const body = `${payload.status} readings detected: ${details.join(', ')}`;

    const channels = isCritical
      ? [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS]
      : [NotificationChannel.IN_APP];

    for (const channel of channels) {
      await this.createNotification({
        elderlyId: payload.elderlyId,
        recipientUserId: payload.recordedBy,
        type: NotificationType.VITAL_SIGN_ALERT,
        channel,
        priority,
        title,
        body,
        metadata: { vitalSignsId: vs.id, status: payload.status },
      });
    }

    this.logger.warn(
      `Health alert [${payload.status}] for elderly ${payload.elderlyId}: ${body}`,
    );
  }

  // ── Create Notification ───────────────────────────────────────────────────

  async createNotification(data: {
    elderlyId?: string;
    recipientUserId: string;
    type: NotificationType;
    channel?: NotificationChannel;
    priority?: NotificationPriority;
    title: string;
    body: string;
    metadata?: Record<string, any>;
  }) {
    const notification = this.notificationRepo.create({
      elderlyId: data.elderlyId,
      recipientUserId: data.recipientUserId,
      type: data.type,
      channel: data.channel ?? NotificationChannel.IN_APP,
      priority: data.priority ?? NotificationPriority.MEDIUM,
      title: data.title,
      body: data.body,
      metadata: data.metadata,
      sentAt: new Date(),
    });

    return this.notificationRepo.save(notification);
  }

  // ── UC-14: Get Notifications for User ─────────────────────────────────────

  async getUserNotifications(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; offset?: number },
  ) {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.recipientUserId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC');

    if (options.unreadOnly) {
      qb.andWhere('n.isRead = false');
    }

    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    qb.take(limit).skip(offset);

    const [notifications, total] = await qb.getManyAndCount();

    return {
      notifications,
      total,
      unread: await this.notificationRepo.count({
        where: { recipientUserId: userId, isRead: false },
      }),
    };
  }

  // ── Mark Notification as Read ─────────────────────────────────────────────

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, recipientUserId: userId },
    });

    if (!notification) throw new NotFoundException('Notification not found.');

    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationRepo.save(notification);
  }

  // ── Mark All as Read ──────────────────────────────────────────────────────

  async markAllAsRead(userId: string) {
    await this.notificationRepo.update(
      { recipientUserId: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { message: 'All notifications marked as read.' };
  }

  // ── Send Medication Reminder Notification ─────────────────────────────────

  async sendMedicationReminder(payload: {
    elderlyId: string;
    recipientUserId: string;
    medicationName: string;
    scheduledTime: Date;
  }) {
    return this.createNotification({
      elderlyId: payload.elderlyId,
      recipientUserId: payload.recipientUserId,
      type: NotificationType.MEDICATION_REMINDER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.HIGH,
      title: '💊 Medication Reminder',
      body: `Time to take ${payload.medicationName}`,
      metadata: { scheduledTime: payload.scheduledTime },
    });
  }
}
