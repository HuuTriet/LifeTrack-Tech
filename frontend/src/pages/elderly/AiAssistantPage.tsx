import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, CircularProgress,
  Avatar, Chip, Paper,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import api from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  '💊 Tôi nên uống thuốc huyết áp vào lúc nào?',
  '❤️ Huyết áp bao nhiêu là bình thường?',
  '🍚 Người tiểu đường nên ăn gì?',
  '🏃 Bài tập nào tốt cho người cao tuổi?',
  '😴 Làm sao để ngủ ngon hơn?',
  '🌡️ Sốt bao nhiêu độ là cần đi viện?',
];

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <Typography key={i} sx={{ fontWeight: 700, mt: i > 0 ? 0.5 : 0 }}>{line.slice(2, -2)}</Typography>;
    }
    if (line.startsWith('- ') || line.startsWith('✅ ') || line.startsWith('🚫 ') || line.startsWith('⚠️ ') || line.startsWith('🥦')) {
      return <Typography key={i} sx={{ pl: 0.5, fontSize: '0.97rem' }}>{line}</Typography>;
    }
    if (line.trim() === '') return <Box key={i} sx={{ height: 6 }} />;
    return <Typography key={i} sx={{ fontSize: '0.97rem' }}>{line}</Typography>;
  });
}

const AiAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Xin chào! Tôi là trợ lý sức khoẻ AI của LifeTrack Tech 🌟\n\nTôi có thể giúp bạn:\n- 💊 Giải thích về thuốc và lịch uống thuốc\n- ❤️ Giải thích các chỉ số sức khoẻ\n- 🥗 Tư vấn dinh dưỡng cho người cao tuổi\n- 🏃 Gợi ý bài tập nhẹ nhàng\n\nHãy hỏi tôi bất cứ điều gì bạn muốn biết về sức khoẻ nhé!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .slice(-10) // keep last 10 messages for context
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post('/ai/chat', { messages: history });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.reply, timestamp: new Date() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Xin lỗi, tôi gặp sự cố kỹ thuật. Vui lòng thử lại sau. Nếu vấn đề sức khoẻ khẩn cấp, hãy gọi 115 hoặc liên hệ bác sĩ ngay.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 500 }}>
      {/* Header */}
      <Box mb={2}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{
            width: 52, height: 52, borderRadius: '14px',
            background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SmartToyIcon sx={{ color: 'white', fontSize: '1.8rem' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color: '#2E5C7F' }}>
              🤖 Trợ lý AI Sức khoẻ
            </Typography>
            <Typography sx={{ color: '#7A8B99', fontSize: '0.95rem' }}>
              Hỏi tôi về sức khoẻ, thuốc, dinh dưỡng...
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#FFF8E7', borderRadius: '12px', border: '1px solid #F4D58D' }}>
          <Typography sx={{ fontSize: '0.85rem', color: '#B45309' }}>
            ⚠️ <strong>Lưu ý:</strong> Thông tin từ AI chỉ mang tính tham khảo, không thay thế cho lời khuyên của bác sĩ. Khi có triệu chứng bất thường, hãy liên hệ cơ sở y tế.
          </Typography>
        </Box>
      </Box>

      {/* Chat messages */}
      <Paper
        elevation={0}
        sx={{
          flex: 1, overflowY: 'auto', p: 2,
          borderRadius: '20px', border: '2px solid #E8EDF2',
          bgcolor: '#FAFBFC',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}
      >
        {messages.map((msg, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 1.5,
            }}
          >
            {/* Avatar */}
            <Avatar sx={{
              width: 40, height: 40, flexShrink: 0,
              bgcolor: msg.role === 'assistant' ? '#2E5C7F' : '#E88D5D',
            }}>
              {msg.role === 'assistant'
                ? <SmartToyIcon sx={{ fontSize: '1.3rem' }} />
                : <PersonIcon sx={{ fontSize: '1.3rem' }} />}
            </Avatar>

            {/* Bubble */}
            <Box
              sx={{
                maxWidth: '75%',
                p: 2,
                borderRadius: msg.role === 'user' ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                bgcolor: msg.role === 'user' ? '#2E5C7F' : 'white',
                color: msg.role === 'user' ? 'white' : '#2C3E50',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: msg.role === 'assistant' ? '1px solid #E8EDF2' : 'none',
              }}
            >
              {renderMarkdown(msg.content)}
              <Typography sx={{
                fontSize: '0.75rem',
                color: msg.role === 'user' ? 'rgba(255,255,255,0.65)' : '#A0ADB8',
                mt: 1, textAlign: 'right',
              }}>
                {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          </Box>
        ))}

        {loading && (
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 40, height: 40, bgcolor: '#2E5C7F' }}>
              <SmartToyIcon sx={{ fontSize: '1.3rem' }} />
            </Avatar>
            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: '4px 20px 20px 20px', border: '1px solid #E8EDF2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <Box display="flex" gap={0.5} alignItems="center">
                <CircularProgress size={14} />
                <Typography sx={{ fontSize: '0.95rem', color: '#7A8B99' }}>Đang soạn câu trả lời...</Typography>
              </Box>
            </Box>
          </Box>
        )}
        <div ref={bottomRef} />
      </Paper>

      {/* Quick questions */}
      <Box sx={{ py: 1.5, overflowX: 'auto' }}>
        <Box display="flex" gap={1} sx={{ minWidth: 'max-content' }}>
          {QUICK_QUESTIONS.map((q) => (
            <Chip
              key={q}
              label={q}
              onClick={() => sendMessage(q)}
              disabled={loading}
              sx={{
                fontSize: '0.88rem', height: 36, cursor: 'pointer',
                bgcolor: 'white', border: '2px solid #E8EDF2',
                '&:hover': { borderColor: '#4A8FB8', bgcolor: '#F0F8FF' },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Input */}
      <Box display="flex" gap={1.5} alignItems="flex-end">
        <TextField
          fullWidth
          multiline
          maxRows={3}
          placeholder="Nhập câu hỏi về sức khoẻ của bạn..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          disabled={loading}
          InputProps={{
            sx: { borderRadius: '16px', fontSize: '1.05rem', bgcolor: 'white' },
          }}
        />
        <IconButton
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          sx={{
            width: 52, height: 52, flexShrink: 0,
            background: input.trim() && !loading
              ? 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)'
              : '#E0E0E0',
            color: 'white',
            borderRadius: '14px',
            '&:hover': { background: 'linear-gradient(135deg, #254d6b 0%, #3a7da6 100%)' },
            '&:disabled': { color: '#A0A0A0' },
          }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default AiAssistantPage;
