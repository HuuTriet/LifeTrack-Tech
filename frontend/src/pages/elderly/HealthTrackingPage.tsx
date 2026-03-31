import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, TextField, Button,
  Alert, CircularProgress, Chip, InputAdornment,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AirIcon from '@mui/icons-material/Air';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NotesIcon from '@mui/icons-material/Notes';
import { useForm } from 'react-hook-form';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface FormData {
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  heartRate: string;
  temperature: string;
  spo2: string;
  bloodSugar: string;
  moodScore: string;
  notes: string;
}

interface Props {
  elderlyId?: string;
}

const MOOD_OPTIONS = [
  { value: '1', emoji: '😢', label: 'Rất tệ' },
  { value: '3', emoji: '😕', label: 'Không tốt' },
  { value: '5', emoji: '😐', label: 'Bình thường' },
  { value: '7', emoji: '😊', label: 'Tốt' },
  { value: '9', emoji: '😄', label: 'Rất tốt' },
];

const METRICS = [
  {
    key: 'bloodPressure',
    label: 'Huyết áp',
    icon: <MonitorHeartIcon sx={{ fontSize: '2rem', color: '#E76F51' }} />,
    color: '#E76F51',
    bg: '#FFF5F2',
    fields: [
      { name: 'bloodPressureSystolic' as keyof FormData, label: 'Tâm thu', unit: 'mmHg', placeholder: 'VD: 120', hint: 'Bình thường: 90–130' },
      { name: 'bloodPressureDiastolic' as keyof FormData, label: 'Tâm trương', unit: 'mmHg', placeholder: 'VD: 80', hint: 'Bình thường: 60–90' },
    ],
  },
  {
    key: 'heartRate',
    label: 'Nhịp tim',
    icon: <FavoriteIcon sx={{ fontSize: '2rem', color: '#E76F51' }} />,
    color: '#E76F51',
    bg: '#FFF5F2',
    fields: [
      { name: 'heartRate' as keyof FormData, label: 'Nhịp tim', unit: 'nhịp/phút', placeholder: 'VD: 72', hint: 'Bình thường: 60–100' },
    ],
  },
  {
    key: 'spo2',
    label: 'Oxy trong máu (SpO₂)',
    icon: <AirIcon sx={{ fontSize: '2rem', color: '#4A8FB8' }} />,
    color: '#4A8FB8',
    bg: '#F0F8FF',
    fields: [
      { name: 'spo2' as keyof FormData, label: 'SpO₂', unit: '%', placeholder: 'VD: 98', hint: 'Bình thường: 95–100%' },
    ],
  },
  {
    key: 'temperature',
    label: 'Nhiệt độ cơ thể',
    icon: <ThermostatIcon sx={{ fontSize: '2rem', color: '#F59E0B' }} />,
    color: '#F59E0B',
    bg: '#FFFBEB',
    fields: [
      { name: 'temperature' as keyof FormData, label: 'Nhiệt độ', unit: '°C', placeholder: 'VD: 36.6', hint: 'Bình thường: 36.1–37.2°C' },
    ],
  },
  {
    key: 'bloodSugar',
    label: 'Đường huyết',
    icon: <WaterDropIcon sx={{ fontSize: '2rem', color: '#52B788' }} />,
    color: '#52B788',
    bg: '#F0FDF4',
    fields: [
      { name: 'bloodSugar' as keyof FormData, label: 'Đường huyết', unit: 'mmol/L', placeholder: 'VD: 5.5', hint: 'Bình thường (lúc đói): 3.9–6.1' },
    ],
  },
];

const HealthTrackingPage: React.FC<Props> = ({ elderlyId: elderlyIdProp }) => {
  const getElderlyId = useAuthStore((s) => s.getElderlyId);
  const elderlyId = elderlyIdProp || getElderlyId() || '';
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; status?: string; message: string } | null>(null);
  const [mood, setMood] = useState('7');

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      bloodPressureSystolic: '', bloodPressureDiastolic: '',
      heartRate: '', temperature: '', spo2: '', bloodSugar: '',
      moodScore: '7', notes: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setResult(null);
    try {
      const payload: Record<string, any> = {};
      if (data.bloodPressureSystolic) payload.bloodPressureSystolic = +data.bloodPressureSystolic;
      if (data.bloodPressureDiastolic) payload.bloodPressureDiastolic = +data.bloodPressureDiastolic;
      if (data.heartRate)    payload.heartRate    = +data.heartRate;
      if (data.temperature)  payload.temperature  = +data.temperature;
      if (data.spo2)         payload.spo2         = +data.spo2;
      if (data.bloodSugar)   payload.bloodSugar   = +data.bloodSugar;
      payload.moodScore = +mood;
      if (data.notes) payload.notes = data.notes;

      const res = await api.post(`/health/elderly/${elderlyId}/vitals`, payload);
      const status = res.data?.status;
      setResult({
        ok: true,
        status,
        message: status === 'CRITICAL'
          ? '⚠️ Đã lưu! Một số chỉ số cần chú ý. Hãy liên hệ bác sĩ ngay.'
          : status === 'WARNING'
          ? '✅ Đã lưu! Một số chỉ số hơi bất thường, cần theo dõi.'
          : '✅ Đã lưu thành công! Các chỉ số của bạn bình thường.',
      });
      reset({ bloodPressureSystolic: '', bloodPressureDiastolic: '', heartRate: '', temperature: '', spo2: '', bloodSugar: '', notes: '' });
      setMood('7');
    } catch (err: any) {
      setResult({ ok: false, message: err.response?.data?.message || 'Lỗi lưu dữ liệu. Vui lòng thử lại.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{
      '@keyframes fadeInPage': { from: { opacity: 0 }, to: { opacity: 1 } },
      animation: 'fadeInPage 0.4s ease',
    }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <Box sx={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', mb: 3, minHeight: { xs: 160, md: 200 } }}>
        <Box component="img"
          src="https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=1400&q=80"
          alt="Health check"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
        />
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg, rgba(46,92,127,0.92) 0%, rgba(74,143,184,0.7) 60%, rgba(0,80,140,0.3) 100%)' }} />

        {/* Pulse rings */}
        {[80, 120, 160].map((size, i) => (
          <Box key={i} sx={{
            position: 'absolute', right: { xs: 16, md: 48 }, top: '50%',
            width: size, height: size, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.15)',
            transform: 'translateY(-50%)',
            '@keyframes ringPulse': {
              '0%': { transform: 'translateY(-50%) scale(0.8)', opacity: 0.5 },
              '100%': { transform: 'translateY(-50%) scale(1.1)', opacity: 0 },
            },
            animation: `ringPulse 2.5s ease-out ${i * 0.7}s infinite`,
          }} />
        ))}

        <Box sx={{ position: 'relative', p: { xs: 3, md: 4 }, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MonitorHeartIcon sx={{ fontSize: '1.8rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2rem' } }}>Kiểm tra sức khoẻ</Typography>
              <Typography sx={{ fontSize: '0.9rem', opacity: 0.8 }}>Nhập kết quả đo để theo dõi sức khoẻ mỗi ngày</Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1.5} mt={2} flexWrap="wrap">
            {['💓 Nhịp tim', '🩸 Huyết áp', '🌡️ Nhiệt độ', '💨 SpO₂', '🍬 Đường huyết'].map((tag, i) => (
              <Box key={tag} sx={{
                bgcolor: 'rgba(255,255,255,0.18)', borderRadius: '50px', px: 1.5, py: 0.4,
                '@keyframes tagIn': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                animation: `tagIn 0.3s ease ${i * 0.07}s both`,
              }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{tag}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── DID YOU KNOW BANNER ───────────────────────────────────────────── */}
      <Box sx={{
        mb: 3, p: 2, borderRadius: '16px',
        background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%)',
        border: '1.5px solid #FED7AA',
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
      }}>
        <Typography sx={{ fontSize: '1.6rem', lineHeight: 1 }}>💡</Typography>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#D97706', mb: 0.3 }}>BẠN CÓ BIẾT?</Typography>
          <Typography sx={{ fontSize: '0.9rem', color: '#92400E' }}>
            Đo huyết áp vào buổi sáng trước khi ăn cho kết quả chính xác nhất. Ngồi yên 5 phút trước khi đo.
          </Typography>
        </Box>
      </Box>

      {result && (
        <Alert
          severity={result.ok ? (result.status === 'CRITICAL' ? 'warning' : 'success') : 'error'}
          icon={result.ok ? <CheckCircleIcon /> : undefined}
          sx={{ mb: 3, borderRadius: '16px', fontSize: '1.05rem', fontWeight: 600 }}
        >
          {result.message}
          {result.status && result.status !== 'NORMAL' && (
            <Chip
              label={result.status === 'CRITICAL' ? '⚠️ Cần chú ý' : '⚡ Theo dõi'}
              color={result.status === 'CRITICAL' ? 'error' : 'warning'}
              sx={{ ml: 1, fontWeight: 700 }}
            />
          )}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={2.5}>
          {METRICS.map((metric, idx) => (
            <Grid item xs={12} key={metric.key}>
              <Card sx={{
                borderRadius: '20px', border: `2px solid ${metric.color}30`,
                bgcolor: metric.bg, boxShadow: 'none',
                p: { xs: 2, md: 3 },
                transition: 'all 0.3s ease',
                '&:hover': { boxShadow: `0 8px 30px ${metric.color}20`, transform: 'translateY(-2px)' },
                '@keyframes cardSlide': { from: { opacity: 0, transform: 'translateX(-16px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                animation: `cardSlide 0.4s ease ${idx * 0.08}s both`,
              }}>
                {/* Section header */}
                <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
                  <Box sx={{
                    width: 52, height: 52, borderRadius: '14px',
                    bgcolor: `${metric.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {metric.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#2C3E50' }}>
                    {metric.label}
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  {metric.fields.map((f) => (
                    <Grid item xs={12} sm={6} key={f.name}>
                      <TextField
                        fullWidth
                        label={f.label}
                        type="number"
                        placeholder={f.placeholder}
                        helperText={f.hint}
                        inputProps={{ step: 0.1 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">
                            <Typography sx={{ color: '#7A8B99', fontSize: '0.95rem' }}>{f.unit}</Typography>
                          </InputAdornment>,
                          sx: { fontSize: '1.15rem', borderRadius: '12px' },
                        }}
                        InputLabelProps={{ sx: { fontSize: '1rem' } }}
                        FormHelperTextProps={{ sx: { fontSize: '0.9rem', color: '#7A8B99' } }}
                        sx={{ bgcolor: 'white', borderRadius: '12px' }}
                        {...register(f.name)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Card>
            </Grid>
          ))}

          {/* Mood */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: '20px', border: '2px solid #52B78830', bgcolor: '#F0FDF4', p: { xs: 2, md: 3 }, boxShadow: 'none' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
                <Box sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: '#52B78820', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SentimentVerySatisfiedIcon sx={{ fontSize: '2rem', color: '#52B788' }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#2C3E50' }}>
                  Cảm xúc hôm nay
                </Typography>
              </Box>
              <Grid container spacing={1.5}>
                {MOOD_OPTIONS.map((m) => (
                  <Grid item xs={12 / MOOD_OPTIONS.length} key={m.value}>
                    <Box
                      onClick={() => setMood(m.value)}
                      sx={{
                        textAlign: 'center', cursor: 'pointer', p: 1.5,
                        borderRadius: '14px', border: '2px solid',
                        borderColor: mood === m.value ? '#52B788' : '#E0E0E0',
                        bgcolor: mood === m.value ? '#52B78815' : 'white',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: '#52B788', bgcolor: '#52B78810' },
                      }}
                    >
                      <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.2rem' } }}>{m.emoji}</Typography>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: mood === m.value ? '#52B788' : '#7A8B99', mt: 0.3 }}>
                        {m.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Card>
          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: '20px', p: { xs: 2, md: 3 }, boxShadow: 'none', border: '2px solid #E8EDF2' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <NotesIcon sx={{ fontSize: '1.8rem', color: '#7A8B99' }} />
                <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#2C3E50' }}>
                  Ghi chú thêm (tuỳ chọn)
                </Typography>
              </Box>
              <TextField
                fullWidth multiline rows={3}
                placeholder="Mô tả triệu chứng, lo ngại hoặc ghi chú gì thêm..."
                inputProps={{ style: { fontSize: '1.05rem' } }}
                sx={{ bgcolor: '#FAFAFA', borderRadius: '12px' }}
                {...register('notes')}
              />
            </Card>
          </Grid>

          {/* Submit */}
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
              sx={{
                py: 2, fontSize: '1.2rem', fontWeight: 700,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
                boxShadow: '0 6px 20px rgba(46,92,127,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #254d6b 0%, #3a7da6 100%)' },
              }}
            >
              {submitting
                ? <><CircularProgress size={22} color="inherit" sx={{ mr: 1 }} />Đang lưu...</>
                : '💾 Lưu kết quả kiểm tra'}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* ── QUICK TIPS BEFORE MEASURING ───────────────────────────────────── */}
      <Box mt={4} mb={3} sx={{
        display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5,
      }}>
        {[
          { icon: '🪑', tip: 'Ngồi thẳng, thả lỏng cánh tay khi đo huyết áp' },
          { icon: '⏱️', tip: 'Nghỉ 5 phút trước khi đo để có kết quả chính xác' },
          { icon: '🚭', tip: 'Không hút thuốc hoặc uống cà phê trước khi đo' },
          { icon: '📅', tip: 'Đo cùng một thời điểm mỗi ngày để theo dõi xu hướng' },
        ].map((item, i) => (
          <Box key={i} sx={{
            minWidth: 160, p: 1.5, borderRadius: '14px',
            bgcolor: 'white', border: '1.5px solid #E2E8F0',
            flexShrink: 0,
            '@keyframes tipCard': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
            animation: `tipCard 0.4s ease ${i * 0.1}s both`,
          }}>
            <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{item.icon}</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>{item.tip}</Typography>
          </Box>
        ))}
      </Box>

      {/* Reference guide */}
      <Box mt={0} p={3} sx={{ bgcolor: '#F0F8FF', borderRadius: '20px', border: '2px solid #C8E6FA' }}>
        <Typography sx={{ fontWeight: 700, color: '#2E5C7F', mb: 1.5, fontSize: '1.05rem' }}>
          📋 Bảng chỉ số tham khảo
        </Typography>
        <Grid container spacing={1.5}>
          {[
            { label: 'Huyết áp', normal: '90–130 / 60–90 mmHg', warning: '>140/90 hoặc <90/60' },
            { label: 'Nhịp tim', normal: '60–100 nhịp/phút', warning: '>100 hoặc <60' },
            { label: 'SpO₂', normal: '95–100%', warning: '<92%' },
            { label: 'Nhiệt độ', normal: '36.1–37.2°C', warning: '>38°C hoặc <35.5°C' },
            { label: 'Đường huyết', normal: '3.9–6.1 mmol/L', warning: '>11 hoặc <3.5' },
          ].map((row) => (
            <Grid item xs={12} sm={6} key={row.label}>
              <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: '12px', border: '1px solid #E8EDF2' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#2E5C7F' }}>{row.label}</Typography>
                <Typography sx={{ fontSize: '0.9rem', color: '#52B788' }}>✅ Bình thường: {row.normal}</Typography>
                <Typography sx={{ fontSize: '0.85rem', color: '#E76F51' }}>⚠️ Cần chú ý: {row.warning}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default HealthTrackingPage;
