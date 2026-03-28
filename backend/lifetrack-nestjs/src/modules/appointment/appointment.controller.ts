import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly svc: AppointmentService) {}

  @Post()
  create(@Body() dto: CreateAppointmentDto, @Request() req: any) {
    return this.svc.create(dto, req.user.userId);
  }

  @Get('elderly/:elderlyId')
  findByElderly(
    @Param('elderlyId') elderlyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.svc.findByElderly(
      elderlyId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      status,
      upcoming === 'true',
    );
  }

  @Get('elderly/:elderlyId/upcoming')
  findUpcoming(
    @Param('elderlyId') elderlyId: string,
    @Query('days') days?: string,
  ) {
    return this.svc.findUpcoming(elderlyId, days ? parseInt(days) : 7);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.svc.cancel(id);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string, @Body() body: { doctorNotes?: string }) {
    return this.svc.complete(id, body.doctorNotes);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
