import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { User, UserRole, UserStatus } from '../../entities/auth/user.entity';
import { Elderly } from '../../entities/auth/elderly.entity';
import { MailService } from '../mail/mail.service';
import {
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const OTP_EXPIRY_MINUTES = 15;
const OTP_LENGTH = 6;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // In-memory stores for lockout and OTP (replace with Redis in production)
  private loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();
  private otpStore = new Map<string, { otp: string; expiresAt: Date; userId: string }>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Elderly)
    private readonly elderlyRepository: Repository<Elderly>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // ── Login (UC-01) ──────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const { email, password, rememberMe } = dto;

    // Check lockout
    const attempts = this.loginAttempts.get(email);
    if (attempts?.lockedUntil && new Date() < attempts.lockedUntil) {
      const remaining = Math.ceil(
        (attempts.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account temporarily locked. Try again in ${remaining} minutes.`,
      );
    }

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Account has been suspended.');
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException(
        'Please verify your email before logging in.',
      );
    }

    // Clear failed attempts on success
    this.loginAttempts.delete(email);

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const expiresIn = rememberMe ? '30d' : '7d';
    const tokens = await this.generateTokens(user, expiresIn);

    this.logger.log(`User ${user.id} (${user.role}) logged in`);

    // Fetch elderlyId if role is ELDERLY
    let elderlyId: string | undefined;
    if (user.role === UserRole.ELDERLY) {
      const profile = await this.elderlyRepository.findOne({ where: { userId: user.id } });
      elderlyId = profile?.id;
    }

    const sanitized = this.sanitizeUser(user);
    return {
      user: { ...sanitized, name: sanitized.fullName, elderlyId },
      ...tokens,
    };
  }

  // ── Register (UC-02) ───────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      password: passwordHash,
      role: dto.role || UserRole.ELDERLY,
      status: UserStatus.PENDING_VERIFICATION,
      emailVerified: false,
    });

    const saved = await this.userRepository.save(user);

    // Auto-create profile table entry
    if (saved.role === UserRole.ELDERLY) {
      await this.elderlyRepository.save(this.elderlyRepository.create({ userId: saved.id }));
    }

    // Generate and store OTP
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    this.otpStore.set(dto.email, { otp, expiresAt, userId: saved.id });

    await this.mailService.sendOtp(dto.email, otp, 'verify');

    return {
      message:
        'Registration successful. Please check your email for the verification code.',
      userId: saved.id,
    };
  }

  // ── Verify Email (UC-02) ───────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto) {
    const stored = this.otpStore.get(dto.email);

    if (!stored) {
      throw new BadRequestException('No pending verification for this email.');
    }

    if (new Date() > stored.expiresAt) {
      this.otpStore.delete(dto.email);
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (stored.otp !== dto.otp) {
      throw new BadRequestException('Invalid verification code.');
    }

    await this.userRepository.update(stored.userId, {
      status: UserStatus.ACTIVE,
      emailVerified: true,
    });

    this.otpStore.delete(dto.email);

    const user = await this.userRepository.findOne({ where: { id: stored.userId } });
    const tokens = await this.generateTokens(user!);

    let elderlyId: string | undefined;
    if (user!.role === UserRole.ELDERLY) {
      const profile = await this.elderlyRepository.findOne({ where: { userId: user!.id } });
      elderlyId = profile?.id;
    }

    const sanitized = this.sanitizeUser(user!);
    return {
      message: 'Email verified successfully.',
      user: { ...sanitized, name: sanitized.fullName, elderlyId },
      ...tokens,
    };
  }

  // ── Forgot Password (UC-03) ────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    // Always return the same message (security: don't reveal if email exists)
    const genericMessage =
      'If this email is registered, you will receive a password reset code shortly.';

    if (!user || user.status === UserStatus.SUSPENDED) {
      return { message: genericMessage };
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    this.otpStore.set(`reset:${dto.email}`, {
      otp,
      expiresAt,
      userId: user.id,
    });

    await this.mailService.sendOtp(dto.email, otp, 'reset');

    return { message: genericMessage };
  }

  // ── Reset Password (UC-03) ─────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto & { email: string }) {
    const key = `reset:${dto.email}`;
    const stored = this.otpStore.get(key);

    if (!stored) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    if (new Date() > stored.expiresAt) {
      this.otpStore.delete(key);
      throw new BadRequestException('Reset code has expired. Please request a new one.');
    }

    if (stored.otp !== dto.token) {
      throw new BadRequestException('Invalid reset code.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepository.update(stored.userId, {
      password: passwordHash,
      refreshToken: null as any,
    });

    this.otpStore.delete(key);
    // Clear any lockout
    const user = await this.userRepository.findOne({ where: { id: stored.userId } });
    if (user) this.loginAttempts.delete(user.email);

    return { message: 'Password reset successfully. You can now log in.' };
  }

  // ── Change Password (UC-04) ────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect.');

    const hash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepository.update(userId, { password: hash });

    return { message: 'Password changed successfully.' };
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.refreshToken) throw new UnauthorizedException();

    const matches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!matches) throw new UnauthorizedException('Invalid refresh token.');

    return this.generateTokens(user);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null as any });
    return { message: 'Logged out successfully.' };
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────

  async resendOtp(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { message: 'If this email is registered, a new code has been sent.' };
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    this.otpStore.set(email, { otp, expiresAt, userId: user.id });

    await this.mailService.sendOtp(email, otp, 'verify');

    return { message: 'If this email is registered, a new code has been sent.' };
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private async generateTokens(user: User, expiresIn = '7d') {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn }),
      this.jwtService.signAsync(payload, { expiresIn: '30d' }),
    ]);

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(user.id, { refreshToken: hashedRefresh });

    return { accessToken, refreshToken, expiresIn };
  }

  private async recordFailedAttempt(email: string) {
    const record = this.loginAttempts.get(email) || { count: 0 };
    record.count += 1;

    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      this.logger.warn(
        `Account ${email} locked for ${LOCKOUT_MINUTES} minutes after ${MAX_LOGIN_ATTEMPTS} failed attempts`,
      );
    }

    this.loginAttempts.set(email, record);
  }

  private generateOtp(): string {
    const digits = '0123456789';
    let otp = '';
    const bytes = randomBytes(OTP_LENGTH);
    for (let i = 0; i < OTP_LENGTH; i++) {
      otp += digits[bytes[i] % digits.length];
    }
    return otp;
  }

  sanitizeUser(user: User) {
    const { password, refreshToken, ...safe } = user as any;
    return safe;
  }

  // ── Notification Email OTP ─────────────────────────────────────────────────

  // Separate in-memory store for notification-email OTPs (keyed by email)
  private notifOtpStore = new Map<string, { otp: string; expiresAt: Date }>();

  async sendNotificationEmailOtp(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    this.notifOtpStore.set(email, { otp, expiresAt });
    await this.mailService.sendOtp(email, otp, 'verify');
    this.logger.log(`Notification OTP sent to ${email}`);
    return { message: `Mã xác thực đã được gửi tới ${email}` };
  }

  async verifyNotificationEmailOtp(email: string, otp: string) {
    const entry = this.notifOtpStore.get(email);
    if (!entry) throw new BadRequestException('Mã OTP không tồn tại hoặc đã hết hạn.');
    if (new Date() > entry.expiresAt) {
      this.notifOtpStore.delete(email);
      throw new BadRequestException('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.');
    }
    if (entry.otp !== otp) throw new BadRequestException('Mã OTP không chính xác.');
    this.notifOtpStore.delete(email);
    return { verified: true, email, message: 'Xác thực email thành công!' };
  }

  // ── DEV ONLY: activate account without OTP ─────────────────────────────────
  async devActivate(email: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not available in production.');
    }
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new NotFoundException('User not found.');
    await this.userRepository.update(user.id, {
      status: UserStatus.ACTIVE,
      emailVerified: true,
    });
    // Auto-create elderly profile if missing
    if (user.role === UserRole.ELDERLY) {
      const existing = await this.elderlyRepository.findOne({ where: { userId: user.id } });
      if (!existing) {
        await this.elderlyRepository.save(this.elderlyRepository.create({ userId: user.id }));
      }
    }
    return { message: `Account ${email} activated.` };
  }
}
