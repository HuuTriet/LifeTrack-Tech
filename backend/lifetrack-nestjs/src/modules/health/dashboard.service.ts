import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { VitalSigns } from '../../entities/health/vital-signs.entity';
import { Appointment } from '../../entities/appointment/appointment.entity';
import { MedicationLog } from '../../entities/medication/medication-log.entity';
import { Prescription } from '../../entities/medication/prescription.entity';
import { Activity } from '../../entities/health/activity.entity';
import { Notification } from '../../entities/utilities/notification.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(VitalSigns) private vitalRepo: Repository<VitalSigns>,
    @InjectRepository(Appointment) private apptRepo: Repository<Appointment>,
    @InjectRepository(MedicationLog) private logRepo: Repository<MedicationLog>,
    @InjectRepository(Prescription) private prescRepo: Repository<Prescription>,
    @InjectRepository(Activity) private activityRepo: Repository<Activity>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  async getElderlyDashboard(elderlyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const [
      latestVitals,
      upcomingAppointments,
      todayMedLogs,
      activePrescriptions,
      todayActivity,
      unreadNotifications,
    ] = await Promise.all([
      // Latest vitals
      this.vitalRepo.findOne({
        where: { elderlyId },
        order: { measuredAt: 'DESC' },
      }),
      // Upcoming appointments (next 7 days)
      this.apptRepo.find({
        where: { elderlyId, status: 'SCHEDULED', appointmentDate: Between(today, sevenDaysLater) as any },
        order: { appointmentDate: 'ASC' },
        take: 3,
      }),
      // Today's medication logs
      this.logRepo.find({
        where: { elderlyId, scheduledDate: today as any },
        order: { scheduledTime: 'ASC' },
      }),
      // Active prescriptions
      this.prescRepo.find({
        where: { elderlyId, status: 'ACTIVE' as any },
        relations: ['items'],
      }),
      // Today's activity summary
      this.activityRepo.find({
        where: { elderlyId, performedAt: Between(today, tomorrow) as any },
      }),
      // Unread notifications count
      this.notifRepo.count({
        where: { elderlyId, isRead: false },
      }),
    ]);

    // Build today's medication schedule from active prescriptions
    const todaySchedule = activePrescriptions.flatMap(presc =>
      presc.items
        .filter(item => item.isActive && item.scheduledTimes?.length > 0)
        .flatMap(item =>
          (item.scheduledTimes || []).map(time => {
            const log = todayMedLogs.find(
              l => l.prescriptionItemId === item.id && l.scheduledTime === time,
            );
            return {
              prescriptionItemId: item.id,
              drugName: item.drugNameRaw || `Drug ${item.drugId}`,
              dosage: item.dosage,
              dosageUnit: item.dosageUnit,
              scheduledTime: time,
              status: log?.status || 'PENDING',
              takenAt: log?.takenAt || null,
              instructions: item.instructions,
              mealRelation: item.mealRelation,
            };
          }),
        ),
    ).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    const totalToday = todaySchedule.length;
    const takenToday = todaySchedule.filter(m => m.status === 'TAKEN').length;

    const todaySteps = todayActivity.reduce((s, a) => s + (a.stepsCount || 0), 0);
    const todayCalories = todayActivity.reduce((s, a) => s + (a.caloriesBurned || 0), 0);
    const todayActiveMinutes = todayActivity.reduce((s, a) => s + (a.durationMinutes || 0), 0);

    return {
      vitals: latestVitals,
      medications: {
        schedule: todaySchedule,
        total: totalToday,
        taken: takenToday,
        pending: todaySchedule.filter(m => m.status === 'PENDING').length,
        adherenceRate: totalToday > 0 ? Math.round((takenToday / totalToday) * 100) : 100,
      },
      appointments: {
        upcoming: upcomingAppointments,
        nextAppointment: upcomingAppointments[0] || null,
      },
      activity: {
        todaySteps,
        todayCalories,
        todayActiveMinutes,
        activitiesCount: todayActivity.length,
      },
      notifications: {
        unreadCount: unreadNotifications,
      },
    };
  }
}
