import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { MedicationService } from './medication.service';
import { MedicationLogService } from './medication-log.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../entities/auth/user.entity';

// ─── Inline DTOs for medication log actions ──────────────────────────────────

class LogMedicationDto {
  @ApiProperty({ description: 'Date the medication was scheduled (YYYY-MM-DD)', example: '2025-01-15' })
  @IsDateString()
  scheduledDate: string;

  @ApiProperty({ description: 'Time the medication was scheduled (HH:mm)', example: '08:00' })
  @IsString()
  scheduledTime: string;

  @ApiProperty({ description: 'Drug name for display/logging', example: 'Metformin 500mg' })
  @IsString()
  drugName: string;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Medications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medications')
export class MedicationController {
  constructor(
    private readonly medicationService: MedicationService,
    private readonly medicationLogService: MedicationLogService,
  ) {}

  // ─── Prescription CRUD ────────────────────────────────────────────────────

  /**
   * @route   POST /api/v1/medications/prescriptions
   * @access  CAREGIVER, ADMIN
   *
   * CORE BUSINESS FLOW:
   *   1. Validates items (HTTP 422 if dosage missing & unknownDosage=false)
   *   2. Checks Drug Interactions for ALL non-generic drugs (HTTP 400 if HIGH risk)
   *   3. Saves Prescription + Items + Reminders in a single MySQL transaction
   */
  @Post('prescriptions')
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new prescription',
    description: `
**Medication Safety Flow (Priority #1):**

1. **Dosage Validation**: If any item is missing \`dosage\` and \`unknownDosage\` is not \`true\`, returns **HTTP 422** — frontend MUST prompt the user for manual input.

2. **Generic Reminder Bypass**: If \`isGenericReminder = true\` for an item — ALL safety checks are bypassed, \`requireDisclaimer\` is set automatically.

3. **Drug Interaction Check**:
   - Fetches all active drugs of the patient.
   - Calls Drug Interaction API for each new drug.
   - **HIGH RISK → HTTP 400** with interaction details (blocks prescription).
   - MODERATE risk → warning logged, prescription allowed.

4. **Atomic Save**: Prescription + Items + Reminders saved in a single MySQL ACID transaction.
    `,
  })
  @ApiCreatedResponse({
    description: 'Prescription created successfully',
    schema: {
      example: {
        id: 'uuid',
        elderlyId: 'uuid',
        status: 'ACTIVE',
        items: [{ drugNameRaw: 'Aspirin', dosage: 100, unknownDosage: false }],
        createdAt: '2025-01-15T08:00:00Z',
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description:
      'HTTP 422 — Dosage missing for a drug item. Frontend must force manual entry.',
    schema: {
      example: {
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Dosage is required for drug "Aspirin 100mg". Set unknownDosage=true to skip.',
        field: 'dosage',
        drugRef: 'Aspirin 100mg',
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'HTTP 400 — HIGH RISK drug interaction detected. Prescription is BLOCKED.',
    schema: {
      example: {
        statusCode: 400,
        error: 'Drug Interaction Alert',
        message:
          'Prescription blocked due to HIGH RISK drug interactions. Please consult a physician.',
        interactions: [
          {
            severity: 'HIGH',
            drugA: 'Warfarin',
            drugB: 'Aspirin',
            description: 'Increased risk of bleeding',
            clinicalEffects: 'Hemorrhage, GI bleeding',
          },
        ],
      },
    },
  })
  async createPrescription(
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.medicationService.createPrescription(dto, userId);
  }

  @Get('prescriptions/:id')
  @ApiOperation({ summary: 'Get prescription by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Prescription found' })
  @ApiNotFoundResponse({ description: 'Prescription not found' })
  async getPrescription(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationService.getPrescriptionById(id);
  }

  @Get('prescriptions/elderly/:elderlyId')
  @ApiOperation({ summary: 'Get all prescriptions for an elderly patient' })
  @ApiParam({ name: 'elderlyId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOkResponse({
    description: 'Paginated list of prescriptions',
    schema: {
      example: {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      },
    },
  })
  async getPrescriptionsByElderly(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.medicationService.getPrescriptionsByElderly(elderlyId, +page, +limit);
  }

  /**
   * @route   PATCH /api/v1/medications/prescriptions/:id
   *
   * Re-runs Drug Interaction Check if items are updated.
   * Same safety rules apply as POST.
   */
  @Patch('prescriptions/:id')
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update prescription',
    description:
      'Re-runs Drug Interaction Check if medication items are modified. ' +
      'Same HTTP 400/422 rules apply.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Prescription updated' })
  @ApiBadRequestResponse({ description: 'HIGH RISK drug interaction on update' })
  @ApiUnprocessableEntityResponse({ description: 'Dosage missing on updated item' })
  @ApiNotFoundResponse({ description: 'Prescription not found' })
  async updatePrescription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrescriptionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.medicationService.updatePrescription(id, dto, userId);
  }

  @Delete('prescriptions/:id')
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a prescription' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Prescription deleted' })
  async deletePrescription(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationService.deletePrescription(id);
  }

  // ─── Drug Catalog ─────────────────────────────────────────────────────────

  @Get('drugs/search')
  @ApiOperation({
    summary: 'Search drug catalog',
    description: 'Full-text search on drug generic/brand name. Results cached in Redis (10 min).',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query', example: 'Aspirin' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Matching drugs' })
  async searchDrugs(
    @Query('q') query: string,
    @Query('limit') limit = 20,
  ) {
    return this.medicationService.searchDrugs(query, +limit);
  }

  // ─── Medication Log (UC-08: Mark Taken / Skipped) ─────────────────────────

  /**
   * @route   POST /api/v1/medications/items/:itemId/taken
   * @access  ELDERLY, CAREGIVER, ADMIN
   *
   * Records that a prescription item was taken for a given scheduled date/time.
   * Upserts: if a log already exists for that slot, updates status to TAKEN.
   *
   * The `elderlyId` in the body is required so that caregivers can log on behalf
   * of a patient. For ELDERLY users the frontend passes their own elderlyId.
   */
  @Post('items/:itemId/taken')
  @Roles(UserRole.ELDERLY, UserRole.CAREGIVER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark prescription item as TAKEN',
    description:
      'Records that an elderly patient has taken the prescribed medication at the scheduled time. ' +
      'Creates or updates a MedicationLog entry for the given date/time slot. ' +
      'Pass `elderlyId` in the request body to specify which patient the log is for.',
  })
  @ApiParam({ name: 'itemId', type: 'string', format: 'uuid', description: 'PrescriptionItem ID' })
  @ApiBody({ type: LogMedicationDto })
  @ApiOkResponse({
    description: 'Log entry recorded',
    schema: {
      example: {
        id: 'uuid',
        status: 'TAKEN',
        takenAt: '2025-01-15T08:05:00Z',
        drugName: 'Metformin 500mg',
      },
    },
  })
  async markTaken(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: LogMedicationDto & { elderlyId?: string },
    @CurrentUser('id') userId: string,
  ) {
    // elderlyId must be supplied in the body by the frontend.
    // If missing fall back to the userId (covers ELDERLY users who ARE the patient).
    const elderlyId = dto.elderlyId || userId;
    return this.medicationLogService.logTaken(
      elderlyId,
      itemId,
      dto.drugName,
      dto.scheduledDate,
      dto.scheduledTime,
      userId,
      dto.notes,
    );
  }

  /**
   * @route   POST /api/v1/medications/items/:itemId/skipped
   * @access  ELDERLY, CAREGIVER, ADMIN
   *
   * Records that a prescription item was skipped for a given scheduled date/time.
   */
  @Post('items/:itemId/skipped')
  @Roles(UserRole.ELDERLY, UserRole.CAREGIVER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark prescription item as SKIPPED',
    description:
      'Records that an elderly patient has skipped a prescribed medication at the scheduled time. ' +
      'Pass `elderlyId` in the request body to specify which patient the log is for.',
  })
  @ApiParam({ name: 'itemId', type: 'string', format: 'uuid', description: 'PrescriptionItem ID' })
  @ApiBody({ type: LogMedicationDto })
  @ApiOkResponse({ description: 'Log entry recorded' })
  async markSkipped(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: LogMedicationDto & { elderlyId?: string },
    @CurrentUser('id') userId: string,
  ) {
    const elderlyId = dto.elderlyId || userId;
    return this.medicationLogService.logSkipped(
      elderlyId,
      itemId,
      dto.drugName,
      dto.scheduledDate,
      dto.scheduledTime,
      userId,
      dto.notes,
    );
  }

  /**
   * @route   GET /api/v1/medications/logs/elderly/:elderlyId
   * @access  CAREGIVER, ADMIN, ELDERLY (own)
   *
   * Returns all medication logs for an elderly patient on a specific date.
   * Used by the MedicationSchedulePage to show today's medication list.
   */
  @Get('logs/elderly/:elderlyId')
  @ApiOperation({
    summary: 'Get medication adherence logs for a date',
    description:
      'Returns medication logs for an elderly patient on the given date. ' +
      'If no date is provided, defaults to today.',
  })
  @ApiParam({ name: 'elderlyId', type: 'string', format: 'uuid' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2025-01-15',
    description: 'YYYY-MM-DD format. Defaults to today.',
  })
  @ApiOkResponse({
    description: 'List of medication logs for the date',
    schema: {
      example: [
        {
          id: 'uuid',
          elderlyId: 'uuid',
          prescriptionItemId: 'uuid',
          drugName: 'Metformin 500mg',
          scheduledDate: '2025-01-15',
          scheduledTime: '08:00',
          status: 'TAKEN',
          takenAt: '2025-01-15T08:05:00Z',
        },
      ],
    },
  })
  async getAdherenceByDate(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
    @Query('date') date?: string,
  ) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.medicationLogService.getAdherenceByDate(elderlyId, targetDate);
  }

  /**
   * @route   GET /api/v1/medications/logs/elderly/:elderlyId/stats
   * @access  CAREGIVER, ADMIN
   *
   * Returns adherence statistics for a configurable window of days.
   * Used on the CaregiverDashboard to display medication adherence %.
   */
  @Get('logs/elderly/:elderlyId/stats')
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get medication adherence statistics',
    description:
      'Aggregated medication adherence stats (taken / skipped / pending counts and rate) ' +
      'for a given number of past days.',
  })
  @ApiParam({ name: 'elderlyId', type: 'string', format: 'uuid' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    example: 30,
    description: 'Number of past days to include (default: 30)',
  })
  @ApiOkResponse({
    description: 'Adherence statistics',
    schema: {
      example: {
        period: '30 days',
        total: 90,
        taken: 78,
        skipped: 8,
        pending: 4,
        adherenceRate: 87,
      },
    },
  })
  async getAdherenceStats(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
    @Query('days') days = 30,
  ) {
    return this.medicationLogService.getAdherenceStats(elderlyId, +days);
  }
}
