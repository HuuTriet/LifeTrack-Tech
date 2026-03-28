import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST') || 'smtp.gmail.com',
      port: parseInt(this.configService.get<string>('MAIL_PORT') || '587', 10),
      secure: false, // TLS
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendOtp(to: string, otp: string, type: 'verify' | 'reset' = 'verify'): Promise<void> {
    const subject =
      type === 'verify'
        ? 'LifeTrack Tech – Mã xác thực email'
        : 'LifeTrack Tech – Mã đặt lại mật khẩu';

    const action = type === 'verify' ? 'xác thực tài khoản' : 'đặt lại mật khẩu';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background: #2E5C7F; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0;">🛡️ LifeTrack Tech</h2>
        </div>
        <div style="border: 1px solid #e0e0e0; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
          <p>Xin chào,</p>
          <p>Mã OTP để <strong>${action}</strong> của bạn là:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2E5C7F; background: #f0f4f8; padding: 16px 24px; border-radius: 8px;">
              ${otp}
            </span>
          </div>
          <p style="color: #666;">Mã có hiệu lực trong <strong>15 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="font-size: 12px; color: #999;">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM') || 'LifeTrack Tech <noreply@lifetrack.com>',
        to,
        subject,
        html,
      });
      this.logger.log(`OTP email sent to ${to}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
      throw err;
    }
  }
}
