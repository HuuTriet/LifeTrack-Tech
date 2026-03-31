import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';

import { User, UserStatus } from '../../entities/auth/user.entity';
import { Elderly } from '../../entities/auth/elderly.entity';
import {
  UpdateProfileDto,
  UpdateElderlyProfileDto,
  CreateElderlyProfileDto,
  AdminUpdateUserDto,
  UserQueryDto,
} from './dto/user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Elderly)
    private readonly elderlyRepo: Repository<Elderly>,
  ) {}

  // ── UC-04: Manage Personal Profile ───────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const { password, refreshToken, ...safe } = user as any;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    await this.userRepo.update(userId, {
      fullName: dto.fullName ?? user.fullName,
      phoneNumber: dto.phoneNumber ?? user.phoneNumber,
      avatarUrl: dto.avatarUrl ?? user.avatarUrl,
    });

    return this.getProfile(userId);
  }

  // ── UC-05: Manage Elderly Profile ─────────────────────────────────────────

  async getElderlyProfile(elderlyId: string) {
    const elderly = await this.elderlyRepo.findOne({
      where: { id: elderlyId },
      relations: ['user'],
    });
    if (!elderly) throw new NotFoundException('Elderly profile not found.');
    return elderly;
  }

  async getElderlyProfileByUserId(userId: string) {
    const elderly = await this.elderlyRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!elderly) throw new NotFoundException('Elderly profile not found for this user.');
    return elderly;
  }

  async createElderlyProfile(dto: CreateElderlyProfileDto, createdBy: string) {
    let resolvedUserId = dto.userId;

    if (!resolvedUserId && dto.email) {
      const found = await this.userRepo.findOne({ where: { email: dto.email } });
      if (!found) throw new NotFoundException(`Không tìm thấy tài khoản với email "${dto.email}". Người dùng cần đăng ký trước.`);
      resolvedUserId = found.id;
    }

    if (!resolvedUserId) throw new NotFoundException('Vui lòng cung cấp userId hoặc email của bệnh nhân.');

    const user = await this.userRepo.findOne({ where: { id: resolvedUserId } });
    if (!user) throw new NotFoundException('User not found.');

    const existing = await this.elderlyRepo.findOne({ where: { userId: resolvedUserId } });
    if (existing) {
      // If profile has no caregiver yet (orphaned), assign this caregiver
      if (!existing.caregiverId) {
        await this.elderlyRepo.update(existing.id, { caregiverId: createdBy });
        return this.getElderlyProfile(existing.id);
      }
      throw new ConflictException('Hồ sơ bệnh nhân đã tồn tại cho người dùng này.');
    }

    const elderly = this.elderlyRepo.create({
      userId: resolvedUserId,
      caregiverId: createdBy,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      gender: dto.gender,
      weight: dto.weight,
      height: dto.height,
      bloodType: dto.bloodType,
      knownAllergies: dto.knownAllergies,
      chronicConditions: dto.chronicConditions,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
      roomNumber: dto.roomNumber,
    });

    this.logger.log(`Elderly profile created for user ${resolvedUserId} by ${createdBy}`);
    return this.elderlyRepo.save(elderly);
  }

  async updateElderlyProfile(elderlyId: string, dto: UpdateElderlyProfileDto) {
    const elderly = await this.elderlyRepo.findOne({ where: { id: elderlyId } });
    if (!elderly) throw new NotFoundException('Elderly profile not found.');

    await this.elderlyRepo.update(elderlyId, {
      ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.weight !== undefined && { weight: dto.weight }),
      ...(dto.height !== undefined && { height: dto.height }),
      ...(dto.bloodType !== undefined && { bloodType: dto.bloodType }),
      ...(dto.knownAllergies !== undefined && { knownAllergies: dto.knownAllergies }),
      ...(dto.chronicConditions !== undefined && { chronicConditions: dto.chronicConditions }),
      ...(dto.emergencyContactName !== undefined && { emergencyContactName: dto.emergencyContactName }),
      ...(dto.emergencyContactPhone !== undefined && { emergencyContactPhone: dto.emergencyContactPhone }),
      ...(dto.roomNumber !== undefined && { roomNumber: dto.roomNumber }),
    });

    return this.getElderlyProfile(elderlyId);
  }

  async softDeleteElderlyProfile(elderlyId: string) {
    const elderly = await this.elderlyRepo.findOne({ where: { id: elderlyId } });
    if (!elderly) throw new NotFoundException('Elderly profile not found.');
    await this.elderlyRepo.softDelete(elderlyId);
    return { message: 'Elderly profile archived successfully.' };
  }

  async listElderlyProfiles(caregiverId?: string) {
    const where: FindOptionsWhere<Elderly> = {};
    if (caregiverId) where.caregiverId = caregiverId;
    return this.elderlyRepo.find({ where, relations: ['user'], order: { createdAt: 'DESC' } });
  }

  // ── Search users by name or email (for caregiver) ────────────────────────

  async searchUsers(q: string, limit = 10) {
    if (!q || q.trim().length < 2) return [];
    const results = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.email', 'u.role', 'u.status'])
      .where('(u.fullName LIKE :q OR u.email LIKE :q)', { q: `%${q.trim()}%` })
      .andWhere('u.deletedAt IS NULL')
      .orderBy('u.fullName', 'ASC')
      .take(limit)
      .getMany();
    return results;
  }

  // ── UC-16: Admin User Management ──────────────────────────────────────────

  async listUsers(query: UserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const where: FindOptionsWhere<User> = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;

    const qb = this.userRepo.createQueryBuilder('u');

    if (query.search) {
      qb.where('(u.fullName LIKE :q OR u.email LIKE :q)', {
        q: `%${query.search}%`,
      });
    }
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.status) qb.andWhere('u.status = :status', { status: query.status });

    const [users, total] = await qb
      .select(['u.id', 'u.fullName', 'u.email', 'u.role', 'u.status', 'u.createdAt', 'u.lastLoginAt'])
      .orderBy('u.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { users, total, page, limit };
  }

  async adminUpdateUser(userId: string, dto: AdminUpdateUserDto, adminId: string) {
    if (userId === adminId && dto.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Administrators cannot suspend their own account.');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    await this.userRepo.update(userId, dto);
    this.logger.log(`Admin ${adminId} updated user ${userId}: ${JSON.stringify(dto)}`);

    return this.getProfile(userId);
  }

  async adminDeleteUser(userId: string, adminId: string) {
    if (userId === adminId) {
      throw new ForbiddenException('Administrators cannot delete their own account.');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    await this.userRepo.softDelete(userId);
    this.logger.log(`Admin ${adminId} soft-deleted user ${userId}`);

    return { message: 'User deleted successfully.' };
  }
}
