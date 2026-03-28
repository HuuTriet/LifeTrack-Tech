import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, LinearProgress,
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
import HighContrastCard from '../../components/common/HighContrastCard';
import ElderlyButton from '../../components/common/ElderlyButton';
import { activityService, Activity, CreateActivityPayload, ActivitySummary } from '../../services/activityService';
import { useAuthStore } from '../../store/authStore';

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

const ActivityPage: React.FC = () => {
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

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2E5C7F', fontSize: { xs: '1.6rem', md: '2rem' } }}>
            🏃 Hoạt động thể chất
          </Typography>
          <Typography sx={{ color: '#7A8B99', mt: 0.5 }}>
            Theo dõi bài tập và vận động trong 7 ngày qua
          </Typography>
        </Box>
        <ElderlyButton icon={<AddIcon />} onClick={() => setOpenAdd(true)}>
          Ghi nhận
        </ElderlyButton>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>}

      {/* Weekly Summary */}
      {summary && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon="🦶"
              value={summary.totalSteps.toLocaleString()}
              label="Bước chân (7 ngày)"
              progress={stepsProgress}
              color="#52B788"
              goal={`Mục tiêu: ${STEPS_GOAL.toLocaleString()}/ngày`}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon="⏱️"
              value={`${summary.totalMinutes} phút`}
              label="Tổng thời gian"
              progress={minutesProgress}
              color="#2E5C7F"
              goal={`Mục tiêu: ${MINUTES_GOAL * 7} phút/tuần`}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon="🔥"
              value={`${summary.totalCalories} kcal`}
              label="Calories đốt"
              color="#E76F51"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon="🏅"
              value={`${summary.totalActivities} buổi`}
              label="Số hoạt động"
              color="#E88D5D"
            />
          </Grid>
        </Grid>
      )}

      {/* Activity List */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={48} />
        </Box>
      ) : activities.length === 0 ? (
        <HighContrastCard title="" accentColor="#52B788">
          <Box textAlign="center" py={4}>
            <DirectionsWalkIcon sx={{ fontSize: '5rem', color: '#C8E6D0', mb: 2 }} />
            <Typography sx={{ fontSize: '1.2rem', color: '#7A8B99', fontWeight: 600 }}>
              Chưa có hoạt động nào trong 7 ngày qua
            </Typography>
            <Typography sx={{ color: '#A0ADB8', mt: 1 }}>
              Nhấn "Ghi nhận" để thêm bài tập hôm nay
            </Typography>
          </Box>
        </HighContrastCard>
      ) : (
        <HighContrastCard title={`🗓️ Hoạt động gần đây (${activities.length})`} accentColor="#52B788">
          <Box display="flex" flexDirection="column" gap={2}>
            {activities.map((act) => {
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
                    bgcolor: '#F8FDF9',
                    borderRadius: '14px',
                    border: '2px solid #C8E6D0',
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                    gap: 2,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                    <Box
                      sx={{
                        width: 48, height: 48, borderRadius: '12px',
                        bgcolor: info.color + '20',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: info.color, flexShrink: 0,
                      }}
                    >
                      {info.icon}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#2C3E50' }}>
                        {info.label}
                      </Typography>
                      <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                        <Chip
                          icon={<TimerIcon />}
                          label={`${act.durationMinutes} phút`}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                        {act.stepsCount && act.stepsCount > 0 && (
                          <Chip label={`${act.stepsCount.toLocaleString()} bước`} size="small" variant="outlined" />
                        )}
                        {act.caloriesBurned && act.caloriesBurned > 0 && (
                          <Chip
                            icon={<WhatshotIcon />}
                            label={`${act.caloriesBurned} kcal`}
                            size="small"
                            sx={{ color: '#E76F51' }}
                          />
                        )}
                        <Chip
                          label={intensityInfo.label}
                          color={intensityInfo.color}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: '0.85rem', color: '#7A8B99', mt: 0.5 }}>
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
                    sx={{ flexShrink: 0, borderRadius: '8px' }}
                    startIcon={<DeleteIcon />}
                  >
                    Xoá
                  </Button>
                </Box>
              );
            })}
          </Box>
        </HighContrastCard>
      )}

      {/* Add Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.3rem', color: '#2E5C7F' }}>
          🏃 Ghi nhận hoạt động
        </DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2.5} pt={1}>
            <TextField
              select
              label="Loại hoạt động"
              value={form.activityType}
              onChange={(e) => setForm({ ...form, activityType: e.target.value })}
              fullWidth
            >
              {ACTIVITY_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Thời lượng (phút) *"
                  type="number"
                  value={form.durationMinutes || ''}
                  onChange={(e) => setForm({ ...form, durationMinutes: +e.target.value })}
                  fullWidth
                  inputProps={{ min: 5, max: 300 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Cường độ"
                  value={form.intensity || 'MODERATE'}
                  onChange={(e) => setForm({ ...form, intensity: e.target.value as any })}
                  fullWidth
                >
                  <MenuItem value="LOW">Nhẹ</MenuItem>
                  <MenuItem value="MODERATE">Trung bình</MenuItem>
                  <MenuItem value="HIGH">Cao</MenuItem>
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
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Calories đốt"
                  type="number"
                  value={form.caloriesBurned || ''}
                  onChange={(e) => setForm({ ...form, caloriesBurned: +e.target.value || undefined })}
                  fullWidth
                  inputProps={{ min: 0 }}
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
            />

            <TextField
              label="Ghi chú"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenAdd(false)} sx={{ fontSize: '1rem' }}>Huỷ</Button>
          <ElderlyButton
            onClick={handleSave}
            disabled={saving || !form.durationMinutes}
            icon={saving ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
          >
            {saving ? 'Đang lưu...' : 'Lưu hoạt động'}
          </ElderlyButton>
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
      border: `2px solid ${color}30`,
      bgcolor: color + '10',
      height: '100%',
    }}
  >
    <Typography sx={{ fontSize: '1.8rem', mb: 0.5 }}>{icon}</Typography>
    <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color, lineHeight: 1 }}>
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
