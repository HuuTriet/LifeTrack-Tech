import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ActivityService, CreateActivityDto } from './activity.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivityController {
  constructor(private readonly svc: ActivityService) {}

  @Post()
  create(@Body() dto: CreateActivityDto, @Request() req: any) {
    return this.svc.create(dto, req.user.userId);
  }

  @Get('elderly/:elderlyId')
  findByElderly(
    @Param('elderlyId') elderlyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    return this.svc.findByElderly(
      elderlyId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      days ? parseInt(days) : undefined,
    );
  }

  @Get('elderly/:elderlyId/summary')
  getSummary(
    @Param('elderlyId') elderlyId: string,
    @Query('days') days?: string,
  ) {
    return this.svc.getSummary(elderlyId, days ? parseInt(days) : 7);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
