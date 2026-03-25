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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { MedicationService } from './medication.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../entities/auth/user.entity';

@ApiTags('Medications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medications')
export class MedicationController {
  constructor(private readonly medicationService: MedicationService) {}

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
}
