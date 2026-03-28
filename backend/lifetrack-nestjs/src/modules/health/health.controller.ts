import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

import { HealthService } from './health.service';
import { DashboardService } from './dashboard.service';
import {
  RecordVitalSignsDto,
  RecordHealthMetricDto,
  HealthTrendsQueryDto,
} from './dto/health.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/auth/user.entity';

@ApiTags('Health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly dashboardService: DashboardService,
  ) {}

  // ── UC-06: Record Vital Signs ─────────────────────────────────────────────

  @Post('elderly/:elderlyId/vitals')
  @ApiOperation({ summary: 'Record vital signs for an elderly patient (UC-06)' })
  @ApiResponse({ status: 201, description: 'Vital signs recorded; alert emitted if abnormal' })
  async recordVitals(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
    @Body() dto: RecordVitalSignsDto,
    @CurrentUser() user: User,
  ) {
    return this.healthService.recordVitalSigns(elderlyId, dto, user.id);
  }

  @Get('elderly/:elderlyId/vitals/latest')
  @ApiOperation({ summary: 'Get latest vital signs for an elderly patient' })
  async getLatestVitals(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
  ) {
    return this.healthService.getLatestVitalSigns(elderlyId);
  }

  @Get('elderly/:elderlyId/vitals')
  @ApiOperation({ summary: 'Get vital signs history (UC-06, UC-07)' })
  async getVitalsHistory(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
    @Query() query: HealthTrendsQueryDto,
  ) {
    return this.healthService.getVitalSignsHistory(elderlyId, query);
  }

  // ── UC-07: Health Trends ──────────────────────────────────────────────────

  @Get('elderly/:elderlyId/trends')
  @ApiOperation({ summary: 'Get health trends with anomaly detection (UC-07)' })
  async getHealthTrends(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
    @Query() query: HealthTrendsQueryDto,
  ) {
    return this.healthService.getHealthTrends(elderlyId, query);
  }

  // ── Health Metrics ────────────────────────────────────────────────────────

  @Post('elderly/:elderlyId/metrics')
  @ApiOperation({ summary: 'Record a health metric (weight, mood, etc.) (UC-06)' })
  async recordMetric(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
    @Body() dto: RecordHealthMetricDto,
  ) {
    return this.healthService.recordHealthMetric(elderlyId, dto);
  }

  @Get('elderly/:elderlyId/metrics')
  @ApiOperation({ summary: 'Get health metrics history' })
  async getMetrics(
    @Param('elderlyId', ParseUUIDPipe) elderlyId: string,
    @Query() query: HealthTrendsQueryDto,
  ) {
    return this.healthService.getHealthMetrics(elderlyId, query);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('elderly/:elderlyId/dashboard')
  @ApiOperation({ summary: 'Get consolidated dashboard for an elderly patient' })
  getDashboard(@Param('elderlyId') elderlyId: string) {
    return this.dashboardService.getElderlyDashboard(elderlyId);
  }
}
