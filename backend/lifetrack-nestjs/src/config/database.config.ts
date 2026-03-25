import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/auth/user.entity';
import { Elderly } from '../entities/auth/elderly.entity';
import { Caregiver } from '../entities/auth/caregiver.entity';
import { VitalSigns } from '../entities/health/vital-signs.entity';
import { HealthMetric } from '../entities/health/health-metric.entity';
import { Drug } from '../entities/medication/drug.entity';
import { Prescription } from '../entities/medication/prescription.entity';
import { PrescriptionItem } from '../entities/medication/prescription-item.entity';
import { InteractionLog } from '../entities/medication/interaction-log.entity';
import { Reminder } from '../entities/utilities/reminder.entity';
import { Notification } from '../entities/utilities/notification.entity';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lifetrack_db',
    entities: [
      User,
      Elderly,
      Caregiver,
      VitalSigns,
      HealthMetric,
      Drug,
      Prescription,
      PrescriptionItem,
      InteractionLog,
      Reminder,
      Notification,
    ],
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    charset: 'utf8mb4',
    timezone: '+07:00',
    extra: {
      connectionLimit: 10,
    },
    migrations: ['dist/database/migrations/*.js'],
    migrationsRun: false,
  }),
);
