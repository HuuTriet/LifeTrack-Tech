import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FrequencyUnit,
  MealRelation,
} from '../../../entities/medication/prescription-item.entity';
import { PrescriptionSource } from '../../../entities/medication/prescription.entity';

export class CreatePrescriptionItemDto {
  @ApiPropertyOptional({ description: 'Drug ID (from drug catalog). Omit if isGenericReminder=true' })
  @IsOptional()
  @IsUUID()
  drugId?: string;

  @ApiPropertyOptional({ description: 'Raw drug name from OCR or manual input' })
  @IsOptional()
  @IsString()
  drugNameRaw?: string;

  /**
   * BUSINESS RULE:
   * If dosage is absent AND unknownDosage is NOT set to true → return HTTP 422
   * (frontend must force manual entry).
   */
  @ApiPropertyOptional({
    description:
      'Dosage amount (e.g. 500 for 500mg). Required unless unknownDosage=true.',
    example: 500,
  })
  @ValidateIf((o) => !o.unknownDosage && !o.isGenericReminder)
  @IsNumber()
  @Min(0.001)
  dosage?: number;

  @ApiPropertyOptional({ example: 'mg' })
  @IsOptional()
  @IsString()
  dosageUnit?: string;

  @ApiPropertyOptional({ description: 'Number of pills/units per dose', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ enum: FrequencyUnit, default: FrequencyUnit.DAILY })
  @IsOptional()
  @IsEnum(FrequencyUnit)
  frequency?: FrequencyUnit;

  @ApiPropertyOptional({ description: 'For EVERY_X_HOURS: interval in hours', example: 8 })
  @IsOptional()
  @IsNumber()
  frequencyInterval?: number;

  @ApiPropertyOptional({
    description: 'Scheduled times in HH:mm format',
    example: ['08:00', '20:00'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scheduledTimes?: string[];

  @ApiPropertyOptional({ enum: MealRelation, default: MealRelation.INDEPENDENT })
  @IsOptional()
  @IsEnum(MealRelation)
  mealRelation?: MealRelation;

  @ApiPropertyOptional({ description: 'Duration in days', example: 7 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  /**
   * BUSINESS FLAG — unknownDosage:
   * true  → OCR could not parse dosage. Bypass overdose warning.
   *         STILL run Drug Interaction Check.
   * false → dosage is mandatory (enforced by ValidateIf above).
   */
  @ApiPropertyOptional({
    description:
      'Set true when dosage is unknown (e.g. OCR failed). ' +
      'Bypasses overdose warning but Drug Interaction Check still runs.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  unknownDosage?: boolean;

  /**
   * BUSINESS FLAG — isGenericReminder:
   * true  → User does not know the drug name; reminder is image-based only.
   *         Bypasses ALL safety checks. Sets requireDisclaimer=true automatically.
   */
  @ApiPropertyOptional({
    description:
      'Set true when drug name is unknown; creates an image-based reminder only. ' +
      'ALL safety checks are bypassed. requireDisclaimer is set automatically.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isGenericReminder?: boolean;

  @ApiPropertyOptional({ description: 'Image URL for generic reminder' })
  @ValidateIf((o) => o.isGenericReminder === true)
  @IsString()
  reminderImageUrl?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({ description: 'Elderly profile ID', example: 'uuid-here' })
  @IsNotEmpty()
  @IsUUID()
  elderlyId: string;

  @ApiPropertyOptional({ description: 'Prescription reference number' })
  @IsOptional()
  @IsString()
  prescriptionNumber?: string;

  @ApiPropertyOptional({ example: 'Dr. Nguyen Van A' })
  @IsOptional()
  @IsString()
  doctorName?: string;

  @ApiPropertyOptional({ example: 'Bệnh viện Đa Khoa' })
  @IsOptional()
  @IsString()
  hospitalName?: string;

  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  prescribedDate?: string;

  @ApiProperty({ example: '2025-01-16' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2025-01-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: PrescriptionSource, default: PrescriptionSource.MANUAL })
  @IsOptional()
  @IsEnum(PrescriptionSource)
  source?: PrescriptionSource;

  @ApiPropertyOptional({ description: 'Diagnosis / reason for prescription' })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreatePrescriptionItemDto], description: 'List of medications' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];
}
