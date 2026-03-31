import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, CircularProgress,
  Avatar, Chip, Slide, Paper, Button,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import MinimizeIcon from '@mui/icons-material/Remove';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import api from '../../services/api';
import { useAiChat } from '../../contexts/AiChatContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Xin chào! Tôi là trợ lý AI của LifeTrack Tech 🌟\n\nTôi có thể giúp bạn:\n💊 Tư vấn về thuốc & lịch uống thuốc\n❤️ Giải thích chỉ số sức khoẻ\n🥗 Dinh dưỡng cho người cao tuổi\n🏃 Gợi ý bài tập phù hợp\n📅 Hướng dẫn đặt lịch hẹn bác sĩ\n\nHãy hỏi hoặc dùng các nút nhanh bên dưới!',
  timestamp: new Date(),
};

const QUICK_QUESTIONS = [
  '💊 Uống thuốc huyết áp lúc nào?',
  '❤️ Huyết áp bình thường là bao nhiêu?',
  '🍚 Người tiểu đường nên ăn gì?',
  '🏃 Bài tập cho người cao tuổi?',
  '😴 Cách ngủ ngon hơn?',
  '🌡️ Sốt bao nhiêu cần đi viện?',
  '⚠️ Tác dụng phụ của thuốc?',
  '📅 Khi nào cần đi khám bác sĩ?',
];

const BUILTIN_ACTIONS: Array<{ key: string; label: string; icon: string; path: string }> = [
  { key: 'ADD_MED', label: 'Thêm nhắc thuốc', icon: '💊', path: '/elderly/medications' },
  { key: 'BOOK_APPT', label: 'Đặt lịch hẹn', icon: '📅', path: '/elderly/appointments' },
  { key: 'ADD_ACTIVITY', label: 'Ghi hoạt động', icon: '🏃', path: '/elderly/activity' },
  { key: 'HEALTH_CHECK', label: 'Nhập chỉ số sức khoẻ', icon: '❤️', path: '/elderly/health-check' },
];

// Keywords that trigger action suggestions
const ACTION_KEYWORDS: Array<{ keywords: string[]; actionKey: string }> = [
  { keywords: ['thêm thuốc', 'thêm nhắc thuốc', 'ghi nhận thuốc', 'đặt lịch uống'], actionKey: 'ADD_MED' },
  { keywords: ['đặt lịch', 'đặt hẹn', 'lịch hẹn bác sĩ', 'hẹn khám'], actionKey: 'BOOK_APPT' },
  { keywords: ['ghi nhận hoạt động', 'ghi bài tập', 'thêm hoạt động'], actionKey: 'ADD_ACTIVITY' },
  { keywords: ['đo huyết áp', 'ghi chỉ số', 'nhập sức khoẻ'], actionKey: 'HEALTH_CHECK' },
];

function detectActions(text: string): string[] {
  const lower = text.toLowerCase();
  return ACTION_KEYWORDS
    .filter(({ keywords }) => keywords.some((kw) => lower.includes(kw)))
    .map(({ actionKey }) => actionKey);
}

function renderMarkdown(text: string): React.ReactNode {
  return text.split('\n').map((line, i) => {
    if (line.trim() === '') return <Box key={i} sx={{ height: 4 }} />;
    if (line.startsWith('**') && line.endsWith('**'))
      return <Typography key={i} sx={{ fontWeight: 700, fontSize: '0.88rem' }}>{line.slice(2, -2)}</Typography>;
    return <Typography key={i} sx={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{line}</Typography>;
  });
}

const AiChatPopup: React.FC = () => {
  const { open, closeChat, pendingMessage, clearPending, contextActions } = useAiChat();
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ ...INITIAL_MESSAGE, timestamp: new Date() }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [detectedActions, setDetectedActions] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, minimized]);

  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open, minimized]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setDetectedActions([]);
    if (minimized) setMinimized(false);

    try {
      const history = [...messages, userMsg]
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post('/ai/chat', { messages: history });
      const reply: string = res.data.reply;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, timestamp: new Date() },
      ]);
      // Detect if reply or user message contains action keywords
      setDetectedActions(detectActions(text + ' ' + reply));
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Xin lỗi, tôi gặp sự cố kỹ thuật. Nếu khẩn cấp, hãy gọi 115 hoặc liên hệ bác sĩ.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger pending message after sendMessage is defined
  const pendingHandled = useRef(false);
  useEffect(() => {
    if (open && pendingMessage && !pendingHandled.current) {
      pendingHandled.current = true;
      sendMessage(pendingMessage);
      clearPending();
    }
    if (!open) pendingHandled.current = false;
  });

  if (!open) return null;

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 72, sm: 24 },
          right: { xs: 8, sm: 24 },
          zIndex: 1400,
          width: { xs: 'calc(100vw - 16px)', sm: 390 },
          maxWidth: 430,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 70px rgba(0,0,0,0.25)',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1.5px solid rgba(46,92,127,0.18)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.5,
            background: 'linear-gradient(135deg, #1A4A6A 0%, #4A8FB8 100%)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setMinimized((v) => !v)}
        >
          <Box sx={{
            width: 38, height: 38, borderRadius: '10px',
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <SmartToyIcon sx={{ color: 'white', fontSize: '1.3rem' }} />
          </Box>
          <Box flex={1} minWidth={0}>
            <Typography sx={{ fontWeight: 700, color: 'white', fontSize: '0.95rem', lineHeight: 1.2 }}>
              Trợ lý AI Sức khoẻ
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem' }}>
              {loading ? '⌛ Đang soạn...' : '🟢 Sẵn sàng hỗ trợ'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v); }} sx={{ color: 'white', p: 0.5 }}>
            {minimized ? <OpenInFullIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); closeChat(); }} sx={{ color: 'white', p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── Body ───────────────────────────────────────────────────── */}
        {!minimized && (
          <Box sx={{ bgcolor: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
            {/* Disclaimer */}
            <Box sx={{ px: 2, pt: 1.5 }}>
              <Typography sx={{
                fontSize: '0.72rem', color: '#92400E',
                bgcolor: '#FFF7ED', borderRadius: '8px',
                px: 1.5, py: 0.6, border: '1px solid #FCD34D',
              }}>
                ⚠️ Chỉ tham khảo — không thay thế lời khuyên bác sĩ
              </Typography>
            </Box>

            {/* Context action buttons (from page) */}
            {contextActions.length > 0 && (
              <Box sx={{ px: 2, pt: 1 }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#64748B', mb: 0.5 }}>Thao tác nhanh:</Typography>
                <Box display="flex" gap={0.75} flexWrap="wrap">
                  {contextActions.map((action, i) => (
                    <Button
                      key={i}
                      size="small"
                      variant="outlined"
                      onClick={() => { action.handler(); closeChat(); }}
                      startIcon={<span>{action.icon}</span>}
                      sx={{
                        fontSize: '0.78rem', borderRadius: '8px', py: 0.4,
                        borderColor: '#2E5C7F', color: '#2E5C7F',
                        '&:hover': { bgcolor: '#EBF4FB' },
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}

            {/* Messages */}
            <Box
              sx={{
                height: contextActions.length > 0 ? 300 : 340,
                overflowY: 'auto',
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {messages.map((msg, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    gap: 1,
                  }}
                >
                  <Avatar sx={{
                    width: 28, height: 28, flexShrink: 0,
                    bgcolor: msg.role === 'assistant' ? '#1A4A6A' : '#E88D5D',
                  }}>
                    {msg.role === 'assistant'
                      ? <SmartToyIcon sx={{ fontSize: '0.9rem' }} />
                      : <PersonIcon sx={{ fontSize: '0.9rem' }} />}
                  </Avatar>
                  <Paper
                    elevation={0}
                    sx={{
                      maxWidth: '84%',
                      px: 1.5, py: 1,
                      borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      bgcolor: msg.role === 'user' ? '#1A4A6A' : 'white',
                      color: msg.role === 'user' ? 'white' : '#2C3E50',
                      border: msg.role === 'assistant' ? '1px solid #E2EAF0' : 'none',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    {renderMarkdown(msg.content)}
                    <Typography sx={{
                      fontSize: '0.65rem',
                      color: msg.role === 'user' ? 'rgba(255,255,255,0.55)' : '#B0BCC8',
                      mt: 0.5, textAlign: 'right',
                    }}>
                      {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Paper>
                </Box>
              ))}

              {loading && (
                <Box display="flex" alignItems="flex-end" gap={1}>
                  <Avatar sx={{ width: 28, height: 28, bgcolor: '#1A4A6A' }}>
                    <SmartToyIcon sx={{ fontSize: '0.9rem' }} />
                  </Avatar>
                  <Paper elevation={0} sx={{
                    px: 1.5, py: 0.75, borderRadius: '4px 16px 16px 16px',
                    bgcolor: 'white', border: '1px solid #E2EAF0',
                  }}>
                    <Box display="flex" gap={0.75} alignItems="center">
                      <CircularProgress size={12} sx={{ color: '#2E5C7F' }} />
                      <Typography sx={{ fontSize: '0.82rem', color: '#7A8B99' }}>Đang soạn...</Typography>
                    </Box>
                  </Paper>
                </Box>
              )}
              <div ref={bottomRef} />
            </Box>

            {/* AI-detected action suggestions */}
            {detectedActions.length > 0 && !loading && (
              <Box sx={{ px: 1.5, pb: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#64748B', mb: 0.5 }}>
                  💡 Bạn có muốn:
                </Typography>
                <Box display="flex" gap={0.75} flexWrap="wrap">
                  {detectedActions.map((key) => {
                    const action = BUILTIN_ACTIONS.find((a) => a.key === key);
                    if (!action) return null;
                    return (
                      <Button
                        key={key}
                        size="small"
                        variant="contained"
                        href={action.path}
                        sx={{
                          fontSize: '0.78rem', borderRadius: '8px', py: 0.4,
                          bgcolor: '#2E5C7F',
                          '&:hover': { bgcolor: '#1A4A6A' },
                        }}
                      >
                        {action.icon} {action.label}
                      </Button>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Quick questions */}
            <Box sx={{ px: 1.5, py: 0.75, overflowX: 'auto' }}>
              <Box display="flex" gap={0.75} sx={{ minWidth: 'max-content' }}>
                {QUICK_QUESTIONS.map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    size="small"
                    onClick={() => sendMessage(q)}
                    disabled={loading}
                    sx={{
                      fontSize: '0.75rem', cursor: 'pointer',
                      bgcolor: 'white', border: '1.5px solid #D0DCE8',
                      '&:hover': { borderColor: '#4A8FB8', bgcolor: '#F0F8FF' },
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Input */}
            <Box display="flex" gap={1} alignItems="flex-end" sx={{ px: 1.5, pb: 1.5 }}>
              <TextField
                fullWidth
                multiline
                maxRows={3}
                size="small"
                placeholder="Nhập câu hỏi về sức khoẻ..."
                value={input}
                inputRef={inputRef}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                disabled={loading}
                InputProps={{ sx: { borderRadius: '12px', fontSize: '0.88rem', bgcolor: 'white' } }}
              />
              <IconButton
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                sx={{
                  width: 40, height: 40, flexShrink: 0,
                  background: input.trim() && !loading
                    ? 'linear-gradient(135deg, #1A4A6A 0%, #4A8FB8 100%)'
                    : '#E0E0E0',
                  color: 'white', borderRadius: '12px',
                  '&:hover': { background: 'linear-gradient(135deg, #0F3A58 0%, #3a7da6 100%)' },
                  '&:disabled': { color: '#B0B8C0' },
                }}
              >
                <SendIcon sx={{ fontSize: '1.1rem' }} />
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>
    </Slide>
  );
};

export default AiChatPopup;
