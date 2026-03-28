import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { VitalSigns } from '../../entities/health/vital-signs.entity';
import { HealthMetric } from '../../entities/health/health-metric.entity';
import { Elderly } from '../../entities/auth/elderly.entity';
import { Prescription } from '../../entities/medication/prescription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VitalSigns, HealthMetric, Elderly, Prescription]),
  ],
  providers: [ReportService],
  controllers: [ReportController],
})
export class ReportModule {}
