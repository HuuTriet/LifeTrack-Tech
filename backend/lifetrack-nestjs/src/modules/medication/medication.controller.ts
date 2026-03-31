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
  Res,
  UseGuards,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { MedicationService } from './medication.service';
import { MedicationLogService } from './medication-log.service';
import { MailService } from '../mail/mail.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../entities/auth/user.entity';

// ─── Self-service medication add DTO (for ELDERLY users) ────────────────────

class SelfAddMedicationItemDto {
  @ApiProperty({ example: 'Amlodipine' })
  @IsString()
  drugName: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  dosage?: number;

  @ApiPropertyOptional({ example: 'mg' })
  @IsOptional()
  @IsString()
  dosageUnit?: string;

  @ApiProperty({ description: 'Scheduled times HH:mm', example: ['08:00', '20:00'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  scheduledTimes: string[];

  @ApiPropertyOptional({ example: 'AFTER_MEAL' })
  @IsOptional()
  @IsString()
  mealRelation?: string;

  @ApiPropertyOptional({ example: 'Uống với nước lọc' })
  @IsOptional()
  @IsString()
  instructions?: string;
}

class SelfAddMedicationDto {
  @ApiProperty({ description: 'Elderly profile ID' })
  @IsString()
  elderlyId: string;

  @ApiProperty({ type: [SelfAddMedicationItemDto] })
  @IsArray()
  @Type(() => SelfAddMedicationItemDto)
  items: SelfAddMedicationItemDto[];

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Tự thêm nhắc nhở' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── DTO for email reminder ──────────────────────────────────────────────────

class SendReminderEmailDto {
  @ApiProperty({ description: 'Elderly profile ID', format: 'uuid' })
  @IsString()
  elderlyId: string;

  @ApiProperty({ description: 'Recipient email address', example: 'patient@example.com' })
  @IsString()
  recipientEmail: string;

  @ApiPropertyOptional({ description: 'Patient display name' })
  @IsOptional()
  @IsString()
  patientName?: string;
}

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
    private readonly mailService: MailService,
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

  /**
   * @route   POST /api/v1/medications/self/add
   * @access  ELDERLY
   * Self-service: elderly user adds their own medication reminder
   */
  @Post('self/add')
  @Roles(UserRole.ELDERLY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Elderly: self-add medication reminder' })
  async selfAddMedication(
    @Body() dto: SelfAddMedicationDto,
    @CurrentUser('id') userId: string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const prescriptionDto = {
      elderlyId: dto.elderlyId,
      doctorName: 'Tự thêm',
      source: 'MANUAL',
      startDate: dto.startDate || today,
      endDate: dto.endDate,
      notes: dto.notes,
      items: dto.items.map(item => ({
        drugNameRaw: item.drugName,
        dosage: item.dosage,
        dosageUnit: item.dosageUnit || 'mg',
        scheduledTimes: item.scheduledTimes,
        mealRelation: item.mealRelation || 'INDEPENDENT',
        instructions: item.instructions,
        isGenericReminder: true,
        unknownDosage: !item.dosage,
      })),
    };
    return this.medicationService.createPrescription(prescriptionDto as any, userId);
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

  // ─── Email Medication Reminder ─────────────────────────────────────────────

  /**
   * @route  POST /api/v1/medications/reminders/send-email
   * @access CAREGIVER, ADMIN
   *
   * Fetches today's active prescriptions for the given elderly patient,
   * formats them into an HTML email and sends it to the specified address.
   */
  // ── Helpers for signed action tokens ─────────────────────────────────────────

  private signToken(payload: object): string {
    const secret = process.env.JWT_SECRET || 'lifetrack_jwt_secret';
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${sig}`;
  }

  private verifyToken(token: string): any | null {
    try {
      const [data, sig] = token.split('.');
      const secret = process.env.JWT_SECRET || 'lifetrack_jwt_secret';
      const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      if (expected !== sig) return null;
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
      if (payload.exp && Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  @Post('reminders/send-email')
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN, UserRole.ELDERLY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send medication reminder email with action links (taken / snooze)' })
  @ApiBody({ type: SendReminderEmailDto })
  @ApiOkResponse({ description: 'Email sent successfully' })
  async sendReminderEmail(@Body() dto: SendReminderEmailDto) {
    const today = new Date().toISOString().split('T')[0];
    const { data: prescriptions } = await this.medicationService.getPrescriptionsByElderly(dto.elderlyId, 1, 50);
    const baseUrl = process.env.API_BASE_URL || `http://localhost:3001/api/v1`;

    const activePrescriptions = prescriptions.filter(p => p.status === 'ACTIVE');
    const medications = activePrescriptions.flatMap(p =>
      p.items.map(item => {
        const scheduledTime = item.scheduledTimes?.[0] || '08:00';
        const tokenPayload = {
          elderlyId: dto.elderlyId,
          itemId: item.id,
          recipientEmail: dto.recipientEmail,
          patientName: dto.patientName || 'Bệnh nhân',
          drugName: item.drug?.genericName || (item as any).drugNameRaw || 'Thuốc',
          scheduledDate: today,
          scheduledTime,
          exp: Date.now() + 48 * 60 * 60 * 1000, // 48h expiry
        };
        const token = this.signToken(tokenPayload);
        return {
          drugName: tokenPayload.drugName,
          dosage: item.dosage ? `${item.dosage} ${item.dosageUnit || 'mg'}` : undefined,
          scheduledTimes: item.scheduledTimes ?? [],
          mealRelation: item.mealRelation,
          instructions: item.instructions,
          takenUrl: `${baseUrl}/medications/reminders/email-action?token=${token}&action=taken`,
          snoozeUrl: `${baseUrl}/medications/reminders/email-action?token=${token}&action=snooze`,
        };
      }),
    );

    await this.mailService.sendMedicationReminderEmail(dto.recipientEmail, dto.patientName || 'Bệnh nhân', medications, today);
    return { message: `Email nhắc thuốc đã được gửi đến ${dto.recipientEmail}` };
  }

  // ── Public: handle email action link click ────────────────────────────────────

  @Get('reminders/email-action')
  @Public()
  @ApiOperation({ summary: 'Handle email action link (taken / snooze) — no auth required' })
  async handleEmailAction(
    @Query('token') token: string,
    @Query('action') action: string,
    @Res() res: any,
  ) {
    const payload = this.verifyToken(token);

    const htmlPage = (icon: string, title: string, message: string, color: string) => `
      <!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${title} – LifeTrack Tech</title>
      <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;}
      .card{background:#fff;border-radius:20px;padding:40px 36px;max-width:420px;width:90%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.1);}
      .icon{font-size:56px;margin-bottom:16px;} h2{color:${color};margin:0 0 12px;} p{color:#475569;font-size:15px;line-height:1.6;margin:0;}</style>
      </head><body><div class="card"><div class="icon">${icon}</div><h2>${title}</h2><p>${message}</p></div></body></html>`;

    if (!payload) {
      (res as any).status(400).send(htmlPage('❌', 'Liên kết không hợp lệ', 'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng liên hệ người chăm sóc.', '#E76F51'));
      return;
    }

    try {
      if (action === 'taken') {
        await this.medicationLogService.logTaken(
          payload.elderlyId,
          payload.itemId,
          payload.drugName,
          payload.scheduledDate,
          payload.scheduledTime,
          payload.elderlyId,
        );
        (res as any).send(htmlPage('✅', 'Đã ghi nhận!',
          `Bạn đã uống <strong>${payload.drugName}</strong> lúc ${payload.scheduledTime}.<br><br>Cảm ơn bạn đã tuân thủ lịch uống thuốc. Hãy tiếp tục duy trì nhé! 💪`,
          '#52B788'));
      } else if (action === 'snooze') {
        // Send another reminder email in ~30 min (we send immediately with a note)
        const snoozePayload = { ...payload, exp: Date.now() + 48 * 60 * 60 * 1000 };
        const newToken = this.signToken(snoozePayload);
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
        await this.mailService.sendMedicationReminderEmail(
          payload.recipientEmail,
          payload.patientName,
          [{
            drugName: payload.drugName,
            scheduledTimes: [payload.scheduledTime],
            takenUrl: `${baseUrl}/medications/reminders/email-action?token=${newToken}&action=taken`,
            snoozeUrl: `${baseUrl}/medications/reminders/email-action?token=${newToken}&action=snooze`,
          }],
          payload.scheduledDate,
        );
        (res as any).send(htmlPage('🔔', 'Đã nhắc lại!',
          `Chúng tôi đã gửi lại nhắc nhở uống <strong>${payload.drugName}</strong> vào email của bạn.<br><br>Hãy uống thuốc đúng giờ để bảo vệ sức khoẻ!`,
          '#4A8FB8'));
      } else {
        (res as any).status(400).send(htmlPage('❓', 'Hành động không hợp lệ', 'Yêu cầu không được nhận dạng.', '#94A3B8'));
      }
    } catch {
      (res as any).status(500).send(htmlPage('⚠️', 'Có lỗi xảy ra', 'Không thể xử lý yêu cầu. Vui lòng thử lại hoặc liên hệ người chăm sóc.', '#E76F51'));
    }
  }
}
