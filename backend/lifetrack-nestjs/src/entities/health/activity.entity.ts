import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Elderly } from '../auth/elderly.entity';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'elderly_id' }) elderlyId: string;
  @ManyToOne(() => Elderly, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'elderly_id' })
  elderly: Elderly;

  @Column({ type: 'nvarchar', length: 30, name: 'activity_type' }) activityType: string; // WALK, RUN, EXERCISE, YOGA, SWIMMING, CYCLING, OTHER
  @Column({ name: 'duration_minutes', type: 'int' }) durationMinutes: number;
  @Column({ name: 'steps_count', type: 'int', nullable: true }) stepsCount: number;
  @Column({ name: 'distance_km', type: 'decimal', precision: 6, scale: 3, nullable: true }) distanceKm: number;
  @Column({ name: 'calories_burned', type: 'int', nullable: true }) caloriesBurned: number;
  @Column({ name: 'heart_rate_avg', type: 'int', nullable: true }) heartRateAvg: number;
  @Column({ name: 'heart_rate_max', type: 'int', nullable: true }) heartRateMax: number;
  @Column({ type: 'nvarchar', length: 20, default: 'MODERATE' }) intensity: string; // LOW, MODERATE, HIGH
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ name: 'performed_at', type: 'datetime' }) performedAt: Date;
  @Column({ name: 'recorded_by', nullable: true }) recordedBy: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
