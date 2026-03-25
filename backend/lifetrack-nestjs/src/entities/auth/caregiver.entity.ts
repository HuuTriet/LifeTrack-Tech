import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Elderly } from './elderly.entity';

export enum CertificationStatus {
  VERIFIED = 'VERIFIED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
}

@Entity('caregiver_profiles')
export class Caregiver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 100, name: 'license_number', nullable: true })
  licenseNumber: string;

  @Column({
    type: 'enum',
    enum: CertificationStatus,
    default: CertificationStatus.PENDING,
    name: 'certification_status',
  })
  certificationStatus: CertificationStatus;

  @Column({ length: 200, nullable: true })
  specialization: string;

  @Column({ type: 'int', name: 'years_of_experience', default: 0 })
  yearsOfExperience: number;

  @Column({ length: 500, name: 'workplace', nullable: true })
  workplace: string;

  @Column({ type: 'text', name: 'bio', nullable: true })
  bio: string;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    name: 'average_rating',
    default: 0,
  })
  averageRating: number;

  @Column({ name: 'total_reviews', default: 0 })
  totalReviews: number;

  @OneToMany(() => Elderly, (elderly) => elderly.caregiverId)
  patients: Elderly[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
