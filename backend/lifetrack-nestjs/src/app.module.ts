import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import consulConfig from './config/consul.config';

import { ConsulModule } from './consul/consul.module';
import { AuthModule } from './modules/auth/auth.module';
import { MedicationModule } from './modules/medication/medication.module';
import { OcrModule } from './modules/ocr/ocr.module';

@Module({
  imports: [
    // ── Configuration ────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [databaseConfig, redisConfig, consulConfig],
      cache: true,
    }),

    // ── Database (MySQL via TypeORM) ──────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),

    // ── Redis Cache (NF-01 Performance) ──────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('redis.host'),
        port: configService.get<number>('redis.port'),
        password: configService.get<string>('redis.password') || undefined,
        ttl: configService.get<number>('redis.ttl'),
      }),
      inject: [ConfigService],
    }),

    // ── Service Discovery (Consul) ────────────────────────────────────────
    ConsulModule,

    // ── Feature Modules ───────────────────────────────────────────────────
    AuthModule,
    MedicationModule,
    OcrModule,
  ],
})
export class AppModule {}
