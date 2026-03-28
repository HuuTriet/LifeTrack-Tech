import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { DashboardService } from './dashboard.service';
import { VitalSigns } from '../../entities/health/vital-signs.entity';
import { HealthMetric } from '../../entities/health/health-metric.entity';
import { Elderly } from '../../entities/auth/elderly.entity';
import { Appointment } from '../../entities/appointment/appointment.entity';
import { MedicationLog } from '../../entities/medication/medication-log.entity';
import { Prescription } from '../../entities/medication/prescription.entity';
import { Activity } from '../../entities/health/activity.entity';
import { Notification } from '../../entities/utilities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VitalSigns,
      HealthMetric,
      Elderly,
      Appointment,
      MedicationLog,
      Prescription,
      Activity,
      Notification,
    ]),
    EventEmitterModule,
  ],
  providers: [HealthService, DashboardService],
  controllers: [HealthController],
  exports: [HealthService, DashboardService],
})
export class HealthModule {}
