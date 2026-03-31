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

  async sendMedicationReminderEmail(
    to: string,
    patientName: string,
    medications: Array<{
      drugName: string;
      dosage?: string;
      scheduledTimes?: string[];
      mealRelation?: string;
      instructions?: string;
      takenUrl?: string;
      snoozeUrl?: string;
    }>,
    date: string,
  ): Promise<void> {
    const medRows = medications
      .map(
        (m) => `
        <tr>
          <td style="padding:12px 14px; border-bottom:1px solid #f0f0f0; font-weight:600; color:#1e293b;">${m.drugName}</td>
          <td style="padding:12px 14px; border-bottom:1px solid #f0f0f0; color:#475569;">${m.dosage || '–'}</td>
          <td style="padding:12px 14px; border-bottom:1px solid #f0f0f0; color:#475569;">${(m.scheduledTimes || []).join(', ') || '–'}</td>
          <td style="padding:12px 14px; border-bottom:1px solid #f0f0f0; color:#475569;">${
            m.mealRelation === 'BEFORE' ? 'Trước ăn'
            : m.mealRelation === 'AFTER' ? 'Sau ăn'
            : m.mealRelation === 'WITH' ? 'Trong bữa ăn'
            : 'Không phụ thuộc'
          }</td>
          <td style="padding:12px 14px; border-bottom:1px solid #f0f0f0; color:#475569;">${m.instructions || '–'}</td>
          <td style="padding:12px 14px; border-bottom:1px solid #f0f0f0; text-align:center;">
            ${m.takenUrl ? `<a href="${m.takenUrl}" style="display:inline-block;background:#52B788;color:#fff;font-weight:700;font-size:12px;padding:6px 14px;border-radius:8px;text-decoration:none;margin-right:6px;">✅ Đã uống</a>` : ''}
            ${m.snoozeUrl ? `<a href="${m.snoozeUrl}" style="display:inline-block;background:#F4A261;color:#fff;font-weight:700;font-size:12px;padding:6px 14px;border-radius:8px;text-decoration:none;">🔔 Nhắc lại</a>` : ''}
          </td>
        </tr>`,
      )
      .join('');

    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
        <div style="background: linear-gradient(135deg, #2E5C7F, #4A8FB8); padding: 28px 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700;">💊 Nhắc nhở uống thuốc</h1>
          <p style="color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:14px;">LifeTrack Tech – Chăm sóc sức khoẻ thông minh</p>
        </div>
        <div style="background:#fff; border-radius:0 0 16px 16px; padding:28px 32px; box-shadow:0 4px 20px rgba(0,0,0,0.06);">
          <p style="font-size:16px; color:#1e293b; margin-top:0;">Xin chào <strong>${patientName}</strong>,</p>
          <p style="color:#475569; font-size:14px; line-height:1.6;">
            Dưới đây là lịch uống thuốc của bạn ngày <strong>${date}</strong>.
            Hãy uống đúng giờ và đúng liều để đảm bảo sức khoẻ tốt nhất.
          </p>
          <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:13px;">
            <thead>
              <tr style="background:#EBF4FB;">
                <th style="padding:10px 14px; text-align:left; color:#2E5C7F; font-weight:700; border-bottom:2px solid #BFDBFE;">Tên thuốc</th>
                <th style="padding:10px 14px; text-align:left; color:#2E5C7F; font-weight:700; border-bottom:2px solid #BFDBFE;">Liều dùng</th>
                <th style="padding:10px 14px; text-align:left; color:#2E5C7F; font-weight:700; border-bottom:2px solid #BFDBFE;">Giờ uống</th>
                <th style="padding:10px 14px; text-align:left; color:#2E5C7F; font-weight:700; border-bottom:2px solid #BFDBFE;">Bữa ăn</th>
                <th style="padding:10px 14px; text-align:left; color:#2E5C7F; font-weight:700; border-bottom:2px solid #BFDBFE;">Hướng dẫn</th>
                <th style="padding:10px 14px; text-align:center; color:#2E5C7F; font-weight:700; border-bottom:2px solid #BFDBFE;">Phản hồi</th>
              </tr>
            </thead>
            <tbody>${medRows}</tbody>
          </table>
          <div style="background:#FFF7ED; border-left:4px solid #F4A261; padding:14px 18px; border-radius:8px; margin-top:20px;">
            <p style="margin:0; font-size:13px; color:#92400E;">
              ⚠️ <strong>Lưu ý:</strong> Không tự ý tăng/giảm liều. Liên hệ bác sĩ nếu có phản ứng bất thường.
            </p>
          </div>
          <hr style="border:none; border-top:1px solid #f1f5f9; margin:24px 0;">
          <p style="font-size:12px; color:#94a3b8; margin:0; text-align:center;">
            Email này được gửi tự động bởi hệ thống LifeTrack Tech.<br>
            Không trả lời email này.
          </p>
        </div>
      </div>`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM') || 'LifeTrack Tech <noreply@lifetrack.com>',
        to,
        subject: `💊 Nhắc uống thuốc – ${date} | LifeTrack Tech`,
        html,
      });
      this.logger.log(`Medication reminder email sent to ${to}`);
    } catch (err: any) {
      this.logger.error(`Failed to send medication reminder email to ${to}: ${err.message}`);
      throw err;
    }
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
