import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';

import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import consulConfig from './config/consul.config';

import { ConsulModule } from './consul/consul.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { MedicationModule } from './modules/medication/medication.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UserModule } from './modules/user/user.module';
import { ReportModule } from './modules/report/report.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { ActivityModule } from './modules/activity/activity.module';

@Module({
  imports: [
    // ── Configuration ────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [databaseConfig, redisConfig, consulConfig],
      cache: true,
    }),

    // ── Event Emitter (Observer pattern for health alerts) ────────────────
    EventEmitterModule.forRoot(),

    // ── Database (SQL Server via TypeORM) ─────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),

    // ── Cache (memory cache — đổi sang Redis khi USE_REDIS=true) ─────────
    CacheModule.register({
      isGlobal: true,
      ttl: 600,
    }),

    // ── Service Discovery (Consul) ────────────────────────────────────────
    ConsulModule,
    MailModule,

    // ── Feature Modules ───────────────────────────────────────────────────
    AuthModule,
    UserModule,
    HealthModule,
    NotificationModule,
    MedicationModule,
    ReportModule,
    AppointmentModule,
    ActivityModule,
  ],
})
export class AppModule {}
