import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Grid, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, LinearProgress, Stack, Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import PoolIcon from '@mui/icons-material/Pool';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import TimerIcon from '@mui/icons-material/Timer';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { activityService, Activity, CreateActivityPayload, ActivitySummary } from '../../services/activityService';
import { useAuthStore } from '../../store/authStore';
import { useAiChat } from '../../contexts/AiChatContext';

const ACTIVITY_TYPES = [
  { value: 'WALK', label: 'Đi bộ', icon: <DirectionsWalkIcon />, color: '#52B788' },
  { value: 'RUN', label: 'Chạy bộ', icon: <DirectionsWalkIcon />, color: '#E76F51' },
  { value: 'EXERCISE', label: 'Tập thể dục', icon: <FitnessCenterIcon />, color: '#2E5C7F' },
  { value: 'YOGA', label: 'Yoga', icon: <SelfImprovementIcon />, color: '#9B59B6' },
  { value: 'SWIMMING', label: 'Bơi lội', icon: <PoolIcon />, color: '#3498DB' },
  { value: 'CYCLING', label: 'Đạp xe', icon: <DirectionsBikeIcon />, color: '#E88D5D' },
  { value: 'OTHER', label: 'Khác', icon: <FitnessCenterIcon />, color: '#7A8B99' },
];

const getActivityInfo = (type: string) =>
  ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];

const INTENSITY_LABELS: Record<string, { label: string; color: 'success' | 'warning' | 'error' }> = {
  LOW: { label: 'Nhẹ', color: 'success' },
  MODERATE: { label: 'Trung bình', color: 'warning' },
  HIGH: { label: 'Cao', color: 'error' },
};

const STEPS_GOAL = 7000;
const MINUTES_GOAL = 30;

// ── Animated Counter ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return value;
}

// ── Circular Progress Ring ────────────────────────────────────────────────────
const CircleRing: React.FC<{ value: number; size?: number; color?: string; icon?: string; label?: string }> = ({
  value, size = 100, color = '#52B788', icon, label,
}) => {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}25`} strokeWidth={12} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }}
        />
      </svg>
      <Box position="absolute" top="50%" left="50%" sx={{ transform: 'translate(-50%, -50%)' }} textAlign="center">
        {icon && <Typography sx={{ fontSize: '1.5rem', lineHeight: 1 }}>{icon}</Typography>}
        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color, lineHeight: 1 }}>{Math.round(value)}%</Typography>
      </Box>
      {label && <Typography sx={{ fontSize: '0.75rem', color: '#64748B', mt: 0.5, fontWeight: 600 }}>{label}</Typography>}
    </Box>
  );
};

const ActivityPage: React.FC = () => {
  const { openChat } = useAiChat();
  const getElderlyId = useAuthStore((s) => s.getElderlyId);
  const elderlyId = getElderlyId() ?? '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState<Partial<CreateActivityPayload>>({
    activityType: 'WALK',
    durationMinutes: 30,
    intensity: 'MODERATE',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!elderlyId) return;
    setLoading(true);
    setError('');
    try {
      const [actRes, sumRes] = await Promise.all([
        activityService.getByElderly(elderlyId, { days: 7, limit: 30 }),
        activityService.getSummary(elderlyId, 7),
      ]);
      setActivities(actRes.data);
      setSummary(sumRes);
    } catch {
      setError('Không thể tải dữ liệu hoạt động.');
    } finally {
      setLoading(false);
    }
  }, [elderlyId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.activityType || !form.durationMinutes) return;
    setSaving(true);
    try {
      await activityService.create({
        elderlyId,
        activityType: form.activityType!,
        durationMinutes: form.durationMinutes!,
        stepsCount: form.stepsCount,
        distanceKm: form.distanceKm,
        caloriesBurned: form.caloriesBurned,
        heartRateAvg: form.heartRateAvg,
        intensity: form.intensity || 'MODERATE',
        notes: form.notes,
        performedAt: form.performedAt || new Date().toISOString(),
      });
      setOpenAdd(false);
      setForm({ activityType: 'WALK', durationMinutes: 30, intensity: 'MODERATE' });
      load();
    } catch {
      setError('Không thể lưu hoạt động. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await activityService.delete(id);
      load();
    } catch {
      setError('Không thể xoá hoạt động.');
    }
  };

  const stepsProgress = Math.min(((summary?.totalSteps || 0) / STEPS_GOAL) * 100, 100);
  const minutesProgress = Math.min(((summary?.totalMinutes || 0) / (MINUTES_GOAL * 7)) * 100, 100);

  const animSteps = useCountUp(summary?.totalSteps || 0);
  const animCalories = useCountUp(summary?.totalCalories || 0);
  const animMinutes = useCountUp(summary?.totalMinutes || 0);

  return (
    <Box sx={{
      '@keyframes fadeInPage': { from: { opacity: 0 }, to: { opacity: 1 } },
      animation: 'fadeInPage 0.4s ease',
    }}>
      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'relative',
          borderRadius: '24px',
          overflow: 'hidden',
          mb: 4,
          minHeight: 220,
        }}
      >
        <Box
          component="img"
          src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80"
          alt="Activity"
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(82,183,136,0.85) 0%, rgba(46,92,127,0.80) 100%)',
        }} />
        <Box sx={{ position: 'relative', p: { xs: 3, md: 5 }, color: 'white' }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
            🏃 Hoạt động thể chất
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', opacity: 0.9, mb: 3, maxWidth: 480 }}>
            Theo dõi và ghi nhận các bài tập trong 7 ngày qua. Vận động đều đặn giúp cơ thể khoẻ mạnh.
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenAdd(true)}
              sx={{
                bgcolor: 'white', color: '#52B788',
                fontWeight: 700, fontSize: '1rem',
                borderRadius: '12px', px: 3, py: 1.25,
                '&:hover': { bgcolor: '#F0FDF4' },
              }}
            >
              Ghi nhận hoạt động
            </Button>
            <Button
              variant="outlined"
              startIcon={<SmartToyIcon />}
              onClick={() => openChat('Tôi muốn hỏi về bài tập thể dục phù hợp cho người cao tuổi')}
              sx={{
                borderColor: 'rgba(255,255,255,0.7)', color: 'white',
                fontWeight: 600, fontSize: '1rem',
                borderRadius: '12px', px: 3, py: 1.25,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', borderColor: 'white' },
              }}
            >
              Tư vấn AI
            </Button>
          </Stack>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>}

      {/* ── Weekly Summary with Rings ──────────────────────────────────── */}
      {summary && (
        <Paper elevation={0} sx={{
          borderRadius: '20px', border: '1.5px solid #E2E8F0', mb: 3, p: 2.5,
          background: 'linear-gradient(135deg, #F8FFFE 0%, #EFF6FF 100%)',
          '@keyframes fadeCard': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
          animation: 'fadeCard 0.5s ease 0.1s both',
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B', mb: 2 }}>
            📊 Tổng kết 7 ngày qua
          </Typography>
          <Box display="flex" justifyContent="space-around" flexWrap="wrap" gap={2} mb={2.5}>
            <Box textAlign="center">
              <CircleRing value={stepsProgress} size={96} color="#52B788" icon="🦶" label="Bước chân" />
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#52B788', mt: 0.5 }}>
                {animSteps.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>/ {(STEPS_GOAL * 7).toLocaleString()} mục tiêu</Typography>
            </Box>
            <Box textAlign="center">
              <CircleRing value={minutesProgress} size={96} color="#2E5C7F" icon="⏱️" label="Thời gian" />
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#2E5C7F', mt: 0.5 }}>
                {animMinutes} phút
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>/ {MINUTES_GOAL * 7} phút mục tiêu</Typography>
            </Box>
            <Box textAlign="center">
              <CircleRing value={Math.min((summary.totalCalories / 2000) * 100, 100)} size={96} color="#E76F51" icon="🔥" label="Calories" />
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#E76F51', mt: 0.5 }}>
                {animCalories} kcal
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>đã đốt cháy</Typography>
            </Box>
            <Box textAlign="center">
              <CircleRing value={Math.min((summary.totalActivities / 7) * 100, 100)} size={96} color="#E88D5D" icon="🏅" label="Buổi tập" />
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#E88D5D', mt: 0.5 }}>
                {summary.totalActivities} buổi
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>/ 7 ngày</Typography>
            </Box>
          </Box>

          {/* Achievement badges */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {stepsProgress >= 100 && (
              <Chip label="🏆 Đạt mục tiêu bước chân" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 700 }} />
            )}
            {minutesProgress >= 100 && (
              <Chip label="⭐ Hoàn thành mục tiêu tuần" sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700 }} />
            )}
            {summary.totalActivities >= 5 && (
              <Chip label="🔥 5+ buổi tập tuần này" sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700 }} />
            )}
            {summary.totalCalories >= 1000 && (
              <Chip label="💪 Đốt 1000+ kcal" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700 }} />
            )}
            {summary.totalActivities === 0 && (
              <Chip label="👋 Hãy bắt đầu hôm nay!" sx={{ bgcolor: '#F1F5F9', color: '#475569', fontWeight: 600 }} />
            )}
          </Box>
        </Paper>
      )}

      {/* AI Tip Banner */}
      <Box
        sx={{
          p: 2.5, mb: 3, borderRadius: '16px',
          background: 'linear-gradient(135deg, #EBF9F2 0%, #E0F2FE 100%)',
          border: '1px solid #C3E6CB',
          display: 'flex', alignItems: 'center', gap: 2,
          cursor: 'pointer',
          '&:hover': { opacity: 0.9 },
        }}
        onClick={() => openChat('Tôi muốn hỏi về bài tập thể dục phù hợp cho người cao tuổi')}
      >
        <Box sx={{
          width: 48, height: 48, borderRadius: '12px',
          background: 'linear-gradient(135deg, #52B788 0%, #2E5C7F 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <SmartToyIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, color: '#2E5C7F', fontSize: '1rem' }}>
            AI gợi ý bài tập phù hợp cho bạn
          </Typography>
          <Typography sx={{ color: '#52B788', fontSize: '0.9rem' }}>
            Nhấn để hỏi AI về chế độ tập luyện, mức độ vận động phù hợp với sức khoẻ →
          </Typography>
        </Box>
      </Box>

      {/* Activity List */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={48} sx={{ color: '#52B788' }} />
        </Box>
      ) : activities.length === 0 ? (
        <Box
          sx={{
            p: 5, borderRadius: '20px',
            border: '2px dashed #C8E6D0',
            bgcolor: '#F8FDF9',
            textAlign: 'center',
          }}
        >
          <DirectionsWalkIcon sx={{ fontSize: '5rem', color: '#C8E6D0', mb: 2 }} />
          <Typography sx={{ fontSize: '1.2rem', color: '#7A8B99', fontWeight: 600, mb: 1 }}>
            Chưa có hoạt động nào trong 7 ngày qua
          </Typography>
          <Typography sx={{ color: '#A0ADB8', mb: 3 }}>
            Nhấn "Ghi nhận hoạt động" để thêm bài tập hôm nay
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAdd(true)}
            sx={{
              bgcolor: '#52B788', fontWeight: 700, fontSize: '1rem',
              borderRadius: '12px', px: 3,
              '&:hover': { bgcolor: '#3D9A6A' },
            }}
          >
            Ghi nhận ngay
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#2E5C7F', mb: 2 }}>
            🗓️ Hoạt động gần đây ({activities.length})
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            {activities.map((act, idx) => {
              const info = getActivityInfo(act.activityType);
              const intensityInfo = INTENSITY_LABELS[act.intensity] || INTENSITY_LABELS.MODERATE;
              return (
                <Box
                  key={act.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    p: 2.5,
                    bgcolor: 'white',
                    borderRadius: '16px',
                    border: '1.5px solid #E8F5EE',
                    boxShadow: '0 2px 12px rgba(82,183,136,0.08)',
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                    gap: 2,
                    '&:hover': { boxShadow: '0 8px 28px rgba(82,183,136,0.18)', borderColor: '#52B788', transform: 'translateX(4px)' },
                    transition: 'all 0.25s ease',
                    '@keyframes actSlide': { from: { opacity: 0, transform: 'translateX(-16px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                    animation: `actSlide 0.4s ease ${idx * 0.07}s both`,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2} flex={1}>
                    <Box
                      sx={{
                        width: 56, height: 56, borderRadius: '14px',
                        bgcolor: info.color + '18',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: info.color, flexShrink: 0,
                        fontSize: '1.5rem',
                      }}
                    >
                      {info.icon}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#2C3E50' }}>
                        {info.label}
                      </Typography>
                      <Box display="flex" gap={1} mt={0.75} flexWrap="wrap">
                        <Chip
                          icon={<TimerIcon />}
                          label={`${act.durationMinutes} phút`}
                          size="small"
                          sx={{ fontWeight: 600, bgcolor: '#EBF4FB', color: '#2E5C7F' }}
                        />
                        {act.stepsCount && act.stepsCount > 0 && (
                          <Chip label={`${act.stepsCount.toLocaleString()} bước`} size="small" variant="outlined" />
                        )}
                        {act.caloriesBurned && act.caloriesBurned > 0 && (
                          <Chip
                            icon={<WhatshotIcon />}
                            label={`${act.caloriesBurned} kcal`}
                            size="small"
                            sx={{ color: '#E76F51', bgcolor: '#FEF0EC' }}
                          />
                        )}
                        <Chip
                          label={intensityInfo.label}
                          color={intensityInfo.color}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: '0.88rem', color: '#7A8B99', mt: 0.75 }}>
                        {new Date(act.performedAt).toLocaleString('vi-VN', {
                          weekday: 'short', day: 'numeric', month: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(act.id)}
                    sx={{ flexShrink: 0, borderRadius: '8px', minWidth: 'unset' }}
                    startIcon={<DeleteIcon />}
                  >
                    Xoá
                  </Button>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Add Activity Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#2E5C7F', pb: 1 }}>
          🏃 Ghi nhận hoạt động
        </DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2.5} pt={1}>
            {/* Activity type chips */}
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151', mb: 1 }}>
                Loại hoạt động *
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {ACTIVITY_TYPES.map((t) => (
                  <Chip
                    key={t.value}
                    label={t.label}
                    onClick={() => setForm({ ...form, activityType: t.value })}
                    sx={{
                      fontWeight: 600, fontSize: '0.9rem',
                      bgcolor: form.activityType === t.value ? t.color : t.color + '15',
                      color: form.activityType === t.value ? 'white' : t.color,
                      border: `1.5px solid ${t.color}40`,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: t.color + '30' },
                    }}
                  />
                ))}
              </Stack>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Thời lượng (phút) *"
                  type="number"
                  value={form.durationMinutes || ''}
                  onChange={(e) => setForm({ ...form, durationMinutes: +e.target.value })}
                  fullWidth
                  inputProps={{ min: 5, max: 300 }}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Cường độ"
                  value={form.intensity || 'MODERATE'}
                  onChange={(e) => setForm({ ...form, intensity: e.target.value as any })}
                  fullWidth
                  InputProps={{ sx: { borderRadius: '10px' } }}
                >
                  <MenuItem value="LOW">🟢 Nhẹ</MenuItem>
                  <MenuItem value="MODERATE">🟡 Trung bình</MenuItem>
                  <MenuItem value="HIGH">🔴 Cao</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Số bước chân"
                  type="number"
                  value={form.stepsCount || ''}
                  onChange={(e) => setForm({ ...form, stepsCount: +e.target.value || undefined })}
                  fullWidth
                  inputProps={{ min: 0 }}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Calories đốt (kcal)"
                  type="number"
                  value={form.caloriesBurned || ''}
                  onChange={(e) => setForm({ ...form, caloriesBurned: +e.target.value || undefined })}
                  fullWidth
                  inputProps={{ min: 0 }}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Nhịp tim TB (BPM)"
                  type="number"
                  value={form.heartRateAvg || ''}
                  onChange={(e) => setForm({ ...form, heartRateAvg: +e.target.value || undefined })}
                  fullWidth
                  inputProps={{ min: 40, max: 220 }}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Khoảng cách (km)"
                  type="number"
                  value={form.distanceKm || ''}
                  onChange={(e) => setForm({ ...form, distanceKm: +e.target.value || undefined })}
                  fullWidth
                  inputProps={{ min: 0, step: 0.1 }}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Grid>
            </Grid>

            <TextField
              label="Thời điểm thực hiện"
              type="datetime-local"
              value={form.performedAt || new Date().toISOString().slice(0, 16)}
              onChange={(e) => setForm({ ...form, performedAt: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
              InputProps={{ sx: { borderRadius: '10px' } }}
            />

            <TextField
              label="Ghi chú"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              fullWidth
              multiline
              rows={2}
              InputProps={{ sx: { borderRadius: '10px' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, gap: 1 }}>
          <Button
            onClick={() => setOpenAdd(false)}
            sx={{ fontSize: '1rem', borderRadius: '10px', px: 3 }}
          >
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.durationMinutes}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            sx={{
              fontSize: '1rem', fontWeight: 700, borderRadius: '10px', px: 3,
              bgcolor: '#52B788',
              '&:hover': { bgcolor: '#3D9A6A' },
            }}
          >
            {saving ? 'Đang lưu...' : 'Lưu hoạt động'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: string;
  value: string;
  label: string;
  color: string;
  progress?: number;
  goal?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color, progress, goal }) => (
  <Box
    sx={{
      p: 2.5,
      borderRadius: '16px',
      bgcolor: 'white',
      border: `1.5px solid ${color}25`,
      boxShadow: `0 2px 12px ${color}12`,
      height: '100%',
      transition: 'all 0.25s ease',
      '&:hover': { boxShadow: `0 8px 28px ${color}25`, transform: 'translateY(-4px)' },
    }}
  >
    <Typography sx={{ fontSize: '2rem', mb: 0.5 }}>{icon}</Typography>
    <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color, lineHeight: 1 }}>
      {value}
    </Typography>
    <Typography sx={{ fontSize: '0.85rem', color: '#7A8B99', mt: 0.5 }}>
      {label}
    </Typography>
    {progress !== undefined && (
      <Box mt={1.5}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8, borderRadius: 4,
            bgcolor: color + '20',
            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
          }}
        />
        {goal && (
          <Typography sx={{ fontSize: '0.75rem', color: '#A0ADB8', mt: 0.5 }}>
            {goal}
          </Typography>
        )}
      </Box>
    )}
  </Box>
);

export default ActivityPage;
