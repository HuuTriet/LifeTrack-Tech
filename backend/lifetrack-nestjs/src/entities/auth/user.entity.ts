import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserRole {
  ADMIN = 'ADMIN',
  CAREGIVER = 'CAREGIVER',
  ELDERLY = 'ELDERLY',
  FAMILY = 'FAMILY',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, name: 'full_name' })
  fullName: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 255, name: 'phone_number', nullable: true })
  phoneNumber: string;

  @Column({ length: 255 })
  @Exclude()
  password: string;

  @Column({ type: 'nvarchar', length: 50, default: UserRole.ELDERLY })
  role: UserRole;

  @Column({ type: 'nvarchar', length: 50, default: UserStatus.PENDING_VERIFICATION })
  status: UserStatus;

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl: string;

  @Column({ name: 'refresh_token', length: 500, nullable: true })
  @Exclude()
  refreshToken: string;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
