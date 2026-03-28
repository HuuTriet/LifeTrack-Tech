import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/auth/user.entity';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAREGIVER, UserRole.ADMIN)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('health')
  @ApiOperation({ summary: 'Generate health report for an elderly patient (UC-15)' })
  @ApiQuery({ name: 'elderlyId', required: true, type: String })
  @ApiQuery({ name: 'from', required: true, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'to', required: true, type: String, example: '2024-12-31' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'csv'],
    description: 'Output format',
  })
  async generateHealthReport(
    @Query('elderlyId') elderlyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportService.generateReport(
      { elderlyId, from, to, format },
      user.id,
    );

    if (format === 'csv' && (result as any).contentType) {
      const csvResult = result as { contentType: string; filename: string; data: string };
      res.setHeader('Content-Type', csvResult.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${csvResult.filename}"`,
      );
      return res.send(csvResult.data);
    }

    return result;
  }
}
