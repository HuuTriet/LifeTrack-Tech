import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetricType } from '../../../entities/health/health-metric.entity';

export class RecordVitalSignsDto {
  @ApiPropertyOptional({ description: 'Systolic blood pressure (mmHg)', example: 120 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(300)
  bloodPressureSystolic?: number;

  @ApiPropertyOptional({ description: 'Diastolic blood pressure (mmHg)', example: 80 })
  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(200)
  bloodPressureDiastolic?: number;

  @ApiPropertyOptional({ description: 'Heart rate (bpm)', example: 72 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(250)
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Body temperature (°C)', example: 36.6 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(45)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Blood oxygen saturation (%)', example: 98.5 })
  @IsOptional()
  @IsNumber()
  @Min(70)
  @Max(100)
  spo2?: number;

  @ApiPropertyOptional({ description: 'Blood sugar (mmol/L)', example: 5.5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(35)
  bloodSugar?: number;

  @ApiPropertyOptional({ description: 'Respiratory rate (breaths/min)', example: 16 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'Mood score 1-10', example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  moodScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'ISO datetime of measurement' })
  @IsOptional()
  @IsDateString()
  measuredAt?: string;
}

export class RecordHealthMetricDto {
  @ApiProperty({ enum: MetricType })
  @IsEnum(MetricType)
  metricType: MetricType;

  @ApiProperty({ example: 68.5 })
  @IsNumber()
  value: number;

  @ApiProperty({ example: 'kg' })
  @IsString()
  unit: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

export class HealthTrendsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO)', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', '1y'], default: '30d' })
  @IsOptional()
  @IsString()
  range?: '7d' | '30d' | '90d' | '1y';
}
