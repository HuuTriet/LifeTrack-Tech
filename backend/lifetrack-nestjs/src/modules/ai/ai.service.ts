import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `Bạn là trợ lý sức khoẻ thông minh của ứng dụng LifeTrack Tech, chuyên hỗ trợ người cao tuổi Việt Nam.

Quy tắc trả lời:
- Luôn trả lời bằng tiếng Việt, rõ ràng, dễ hiểu với người cao tuổi
- Dùng ngôn ngữ thân thiện, xưng "tôi" gọi người dùng là "bạn" hoặc "anh/chị"
- Chia thông tin thành các điểm ngắn, dễ đọc
- Với câu hỏi về triệu chứng nguy hiểm: luôn khuyên liên hệ bác sĩ ngay
- Không chẩn đoán bệnh, chỉ cung cấp thông tin tham khảo
- Giải thích các chỉ số sức khoẻ bằng ngôn ngữ đơn giản
- Đưa ra lời khuyên về lối sống lành mạnh, dinh dưỡng, vận động phù hợp người cao tuổi
- Nếu không biết chắc, hãy thành thật và khuyên gặp bác sĩ
- Trả lời ngắn gọn, súc tích, không quá 300 từ

Bạn có thể giúp về:
- Giải thích chỉ số sức khoẻ (huyết áp, nhịp tim, đường huyết, SpO2...)
- Lời khuyên về thuốc thông thường
- Chế độ ăn uống cho người cao tuổi
- Bài tập nhẹ nhàng phù hợp
- Nhắc nhở về tầm quan trọng kiểm tra sức khoẻ định kỳ
- Trả lời câu hỏi về triệu chứng thông thường`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Groq | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (apiKey) {
      this.client = new Groq({ apiKey });
    }
  }

  async chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    elderlyContext?: string,
  ): Promise<{ reply: string; powered_by: string }> {
    if (!this.client) {
      return {
        reply: this.ruleBasedReply(messages[messages.length - 1]?.content || ''),
        powered_by: 'rule-based',
      };
    }

    try {
      const systemWithContext = elderlyContext
        ? `${SYSTEM_PROMPT}\n\nThông tin người dùng: ${elderlyContext}`
        : SYSTEM_PROMPT;

      const response = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemWithContext },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });

      const reply = response.choices[0]?.message?.content
        ?? 'Xin lỗi, tôi không thể xử lý yêu cầu này.';

      return { reply, powered_by: 'groq-llama3' };
    } catch (err) {
      this.logger.error('AI chat error', err);
      return {
        reply: this.ruleBasedReply(messages[messages.length - 1]?.content || ''),
        powered_by: 'rule-based',
      };
    }
  }

  private ruleBasedReply(question: string): string {
    const q = question.toLowerCase();

    if (q.includes('huyết áp')) {
      return `**Huyết áp bình thường** là 120/80 mmHg.\n\n- Cao huyết áp: ≥ 140/90 → cần gặp bác sĩ\n- Huyết áp thấp: < 90/60 → dễ chóng mặt\n\n✅ Đo vào buổi sáng, hạn chế muối, tránh căng thẳng.`;
    }
    if (q.includes('đường huyết') || q.includes('tiểu đường')) {
      return `**Đường huyết bình thường** (lúc đói): 3.9–6.1 mmol/L.\n\n- > 7.0 mmol/L khi đói: nguy cơ tiểu đường\n- > 11 mmol/L: cần gặp bác sĩ ngay\n\n✅ Ăn ít đường, nhiều rau, vận động đều đặn.`;
    }
    if (q.includes('thuốc')) {
      return `**Lưu ý dùng thuốc:**\n\n✅ Uống đúng giờ, đúng liều\n✅ Không tự ngừng thuốc\n✅ Đọc kỹ hướng dẫn: trước hay sau ăn\n\n⚠️ Phản ứng lạ sau uống thuốc → liên hệ bác sĩ ngay.`;
    }
    if (q.includes('ăn') || q.includes('dinh dưỡng')) {
      return `**Dinh dưỡng tốt cho người cao tuổi:**\n\n🥦 Nhiều rau xanh, trái cây\n🐟 Cá, đậu, đậu hũ\n🥛 Sữa ít béo\n\n🚫 Hạn chế: muối, đường, thịt đỏ, rượu bia\n💧 Uống 1.5–2 lít nước/ngày.`;
    }
    if (q.includes('tập') || q.includes('vận động')) {
      return `**Bài tập cho người cao tuổi:**\n\n🚶 Đi bộ 30 phút/ngày\n🤸 Kéo giãn cơ nhẹ\n🏊 Bơi lội (tốt cho khớp)\n\n⚠️ Khởi động trước, uống nước đủ. Ngừng ngay nếu chóng mặt.`;
    }
    if (q.includes('ngủ') || q.includes('mất ngủ')) {
      return `**Cải thiện giấc ngủ:**\n\n✅ Ngủ đúng giờ\n✅ Phòng tối, mát, yên tĩnh\n✅ Không dùng điện thoại 1 giờ trước ngủ\n✅ Tránh cà phê buổi chiều tối\n\n⚠️ Mất ngủ > 2 tuần → gặp bác sĩ.`;
    }

    return `Xin chào! Tôi là trợ lý sức khoẻ AI 🌟\n\nTôi có thể giúp bạn về:\n- 💊 Thuốc và lịch uống thuốc\n- ❤️ Chỉ số sức khoẻ (huyết áp, đường huyết...)\n- 🥗 Dinh dưỡng cho người cao tuổi\n- 🏃 Bài tập nhẹ nhàng\n- 😴 Cải thiện giấc ngủ\n\nHãy hỏi tôi nhé!`;
  }
}
