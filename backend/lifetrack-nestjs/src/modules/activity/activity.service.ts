import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Activity } from '../../entities/health/activity.entity';

export class CreateActivityDto {
  elderlyId: string;
  activityType: string;
  durationMinutes: number;
  stepsCount?: number;
  distanceKm?: number;
  caloriesBurned?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  intensity?: string;
  notes?: string;
  performedAt: string;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity)
    private readonly repo: Repository<Activity>,
  ) {}

  async create(dto: CreateActivityDto, recordedBy: string): Promise<Activity> {
    const activity = this.repo.create({
      ...dto,
      performedAt: new Date(dto.performedAt),
      recordedBy,
    });
    return this.repo.save(activity);
  }

  async findByElderly(elderlyId: string, page = 1, limit = 20, days?: number) {
    const where: any = { elderlyId };
    if (days) {
      const from = new Date();
      from.setDate(from.getDate() - days);
      where.performedAt = Between(from, new Date());
    }
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { performedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getSummary(elderlyId: string, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const activities = await this.repo.find({
      where: { elderlyId, performedAt: Between(from, new Date()) },
    });
    const totalMinutes = activities.reduce((s, a) => s + (a.durationMinutes || 0), 0);
    const totalSteps = activities.reduce((s, a) => s + (a.stepsCount || 0), 0);
    const totalCalories = activities.reduce((s, a) => s + (a.caloriesBurned || 0), 0);
    const totalDistance = activities.reduce((s, a) => s + (Number(a.distanceKm) || 0), 0);
    return {
      period: `${days} days`,
      totalActivities: activities.length,
      totalMinutes,
      totalSteps,
      totalCalories,
      totalDistanceKm: Math.round(totalDistance * 100) / 100,
      activities,
    };
  }

  async delete(id: string): Promise<void> {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Activity not found.');
    await this.repo.delete(id);
  }
}
