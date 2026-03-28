import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { Appointment } from '../../entities/appointment/appointment.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
  ) {}

  async create(dto: CreateAppointmentDto, createdBy: string): Promise<Appointment> {
    const appt = this.repo.create({
      ...dto,
      appointmentDate: new Date(dto.appointmentDate),
      createdBy,
    });
    return this.repo.save(appt);
  }

  async findByElderly(
    elderlyId: string,
    page = 1,
    limit = 10,
    status?: string,
    upcoming?: boolean,
  ) {
    const where: any = { elderlyId };
    if (status) where.status = status;
    if (upcoming) where.appointmentDate = MoreThanOrEqual(new Date());

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { appointmentDate: upcoming ? 'ASC' : 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findUpcoming(elderlyId: string, days = 7): Promise<Appointment[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);
    return this.repo.find({
      where: { elderlyId, status: 'SCHEDULED', appointmentDate: Between(now, future) },
      order: { appointmentDate: 'ASC' },
    });
  }

  async findById(id: string): Promise<Appointment> {
    const appt = await this.repo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException(`Appointment [${id}] not found.`);
    return appt;
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    await this.findById(id);
    if (dto.appointmentDate) {
      (dto as any).appointmentDate = new Date(dto.appointmentDate);
    }
    await this.repo.update(id, dto as any);
    return this.findById(id);
  }

  async cancel(id: string): Promise<Appointment> {
    const appt = await this.findById(id);
    if (appt.status === 'COMPLETED') {
      throw new ForbiddenException('Cannot cancel a completed appointment.');
    }
    await this.repo.update(id, { status: 'CANCELLED' });
    return this.findById(id);
  }

  async complete(id: string, doctorNotes?: string): Promise<Appointment> {
    await this.findById(id);
    await this.repo.update(id, { status: 'COMPLETED', doctorNotes: doctorNotes || undefined });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.repo.delete(id);
  }
}
