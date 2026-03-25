import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * TypeORM DataSource for CLI migrations.
 * Not injected into NestJS DI — used only by migration scripts.
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lifetrack_db',
  entities: ['src/entities/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  charset: 'utf8mb4',
  timezone: '+07:00',
  synchronize: false,
  logging: true,
});
