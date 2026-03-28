import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Grid, Chip, CircularProgress, Alert,
  LinearProgress, IconButton, Tooltip, Switch, FormControlLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import MedicationIcon from '@mui/icons-material/Medication';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import HighContrastCard from '../../components/common/HighContrastCard';
import ElderlyButton from '../../components/common/ElderlyButton';
import { medicationService } from '../../services/medicationService';
import {
  requestNotificationPermission,
  getNotificationPermission,
  startMedicationReminders,
  stopMedicationReminders,
  playAlertSound,
  checkDueMedications,
  type PendingMed,
} from '../../services/notificationService';
import { useAuthStore } from '../../store/authStore';

interface ScheduleItem extends PendingMed {
  mealRelation?: string;
  instructions?: string;
}

const STATUS_STYLE: Record<string, { bg: string; border: string; chip: any; label: string }> = {
  PENDING: { bg: '#FFFBF0', border: '#F4D58D', chip: 'warning', label: 'Chờ uống' },
  TAKEN:   { bg: '#F0FDF4', border: '#86EFAC', chip: 'success', label: 'Đã uống ✓' },
  SKIPPED: { bg: '#F9FAFB', border: '#D1D5DB', chip: 'default', label: 'Bỏ qua' },
  LATE:    { bg: '#FFF1F2', border: '#FDA4AF', chip: 'error',   label: 'Trễ' },
};

const MEAL_LABELS: Record<string, string> = {
  BEFORE_MEAL: 'Trước ăn',
  AFTER_MEAL:  'Sau ăn',
  WITH_MEAL:   'Khi ăn',
  BEFORE:      'Trước ăn',
  AFTER:       'Sau ăn',
  WITH:        'Khi ăn',
  INDEPENDENT: 'Bất kỳ lúc nào',
};

function getCurrentTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isOverdue(time: string, status: string) {
  if (status !== 'PENDING') return false;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m < getCurrentTimeMinutes();
}

// ─────────────────────────────────────────────────────────────────────────────

const MedicationSchedulePage: React.FC = () => {
  const getElderlyId = useAuthStore((s) => s.getElderlyId);
  const elderlyId = getElderlyId() ?? '';

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const [now, setNow] = useState(new Date());
  const [showDone, setShowDone] = useState(true);

  // ── Clock tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Load schedule ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!elderlyId) {
      setError('Không tìm thấy hồ sơ. Vui lòng đăng nhập lại.');
      setLoading(false);
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      const logs = await medicationService.getAdherenceByDate(elderlyId, today);
      setSchedule(logs.map(l => ({
        prescriptionItemId: l.prescriptionItemId,
        drugName: l.drugName,
        scheduledTime: l.scheduledTime,
        status: l.status,
        dosage: undefined,
      })));
    } catch {
      setError('Không thể tải lịch uống thuốc. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [elderlyId]);

  useEffect(() => { load(); }, [load]);

  // ── Notification polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!notifEnabled) { stopMedicationReminders(); return; }
    startMedicationReminders(() => schedule.filter(m => m.status === 'PENDING'));
    return () => stopMedicationReminders();
  }, [notifEnabled, schedule]);

  // ── Mark taken / skipped ────────────────────────────────────────────────────
  const handleMark = async (item: ScheduleItem, status: 'TAKEN' | 'SKIPPED') => {
    setActionId(item.prescriptionItemId);
    try {
      if (elderlyId) {
        const today = new Date().toISOString().split('T')[0];
        if (status === 'TAKEN') {
          await medicationService.markTaken(item.prescriptionItemId, elderlyId, item.drugName, today, item.scheduledTime);
          playAlertSound(); // pleasant confirmation sound
        } else {
          await medicationService.markSkipped(item.prescriptionItemId, elderlyId, item.drugName, today, item.scheduledTime);
        }
      }
    } catch { /* optimistic update anyway */ } finally {
      setSchedule(prev => prev.map(m =>
        m.prescriptionItemId === item.prescriptionItemId ? { ...m, status } : m
      ));
      setActionId(null);
    }
  };

  // ── Enable notifications ────────────────────────────────────────────────────
  const handleToggleNotif = async () => {
    if (!notifEnabled) {
      const granted = await requestNotificationPermission();
      setNotifPermission(getNotificationPermission());
      if (granted) setNotifEnabled(true);
    } else {
      setNotifEnabled(false);
    }
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const pending  = schedule.filter(m => m.status === 'PENDING');
  const taken    = schedule.filter(m => m.status === 'TAKEN');
  const overdue  = pending.filter(m => isOverdue(m.scheduledTime, m.status));
  const adherence = schedule.length > 0
    ? Math.round((taken.length / schedule.length) * 100) : 100;

  const visibleSchedule = showDone
    ? schedule
    : schedule.filter(m => m.status !== 'TAKEN');

  const nowHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2E5C7F', fontSize: { xs: '1.6rem', md: '2rem' } }}>
            💊 Lịch uống thuốc
          </Typography>
          <Typography sx={{ color: '#7A8B99', mt: 0.5 }}>
            {now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {'  ·  🕐 '}
            {nowHHMM}
          </Typography>
        </Box>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          {/* Notification toggle */}
          <Tooltip title={
            notifPermission === 'denied' ? 'Trình duyệt đã chặn thông báo. Vào Cài đặt trình duyệt để bật.' :
            notifEnabled ? 'Tắt nhắc uống thuốc' : 'Bật nhắc uống thuốc (browser notification)'
          }>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                bgcolor: notifEnabled ? '#EBF4FB' : '#F9FAFB',
                borderRadius: '12px', px: 1.5, py: 0.5,
                border: `2px solid ${notifEnabled ? '#4A8FB8' : '#E0E0E0'}`,
                cursor: notifPermission === 'denied' ? 'not-allowed' : 'pointer',
              }}
              onClick={notifPermission !== 'denied' ? handleToggleNotif : undefined}
            >
              {notifEnabled
                ? <NotificationsActiveIcon sx={{ color: '#2E5C7F', fontSize: '1.4rem' }} />
                : <NotificationsOffIcon sx={{ color: '#A0ADB8', fontSize: '1.4rem' }} />}
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: notifEnabled ? '#2E5C7F' : '#A0ADB8' }}>
                {notifEnabled ? 'Nhắc nhở BẬT' : 'Bật nhắc nhở'}
              </Typography>
            </Box>
          </Tooltip>

          <Tooltip title="Kiểm tra thuốc đến giờ ngay">
            <IconButton
              onClick={() => checkDueMedications(schedule.filter(m => m.status === 'PENDING'))}
              sx={{ bgcolor: '#EBF4FB', borderRadius: '10px' }}
            >
              <VolumeUpIcon sx={{ color: '#2E5C7F' }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Tải lại">
            <IconButton onClick={load} sx={{ bgcolor: '#EBF4FB', borderRadius: '10px' }}>
              <RefreshIcon sx={{ color: '#2E5C7F' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {overdue.length > 0 && (
        <Alert
          severity="error"
          icon={<NotificationsActiveIcon />}
          sx={{ mb: 2, borderRadius: '16px', fontWeight: 600 }}
        >
          ⚠️ Bạn có <strong>{overdue.length} thuốc trễ giờ</strong>!{' '}
          {overdue.map(m => m.drugName).join(', ')}
        </Alert>
      )}

      {/* Stats row */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Tổng hôm nay', value: schedule.length, color: '#2E5C7F', bg: '#EBF4FB' },
          { label: 'Đã uống',      value: taken.length,    color: '#52B788', bg: '#F0FDF4' },
          { label: 'Chờ uống',     value: pending.length,  color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Trễ giờ',      value: overdue.length,  color: '#E76F51', bg: '#FFF1F2' },
        ].map(s => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Box sx={{ p: 2, borderRadius: '14px', bgcolor: s.bg, textAlign: 'center', border: `2px solid ${s.color}20` }}>
              <Typography sx={{ fontWeight: 800, fontSize: '2rem', color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#7A8B99', mt: 0.5 }}>{s.label}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Progress bar */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" mb={0.5}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#2C3E50' }}>Tiến độ hôm nay</Typography>
          <Typography sx={{ fontWeight: 700, color: '#52B788' }}>{adherence}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={adherence}
          sx={{
            height: 12, borderRadius: 6,
            bgcolor: '#E8F5EE',
            '& .MuiLinearProgress-bar': {
              bgcolor: adherence === 100 ? '#52B788' : adherence > 60 ? '#4A8FB8' : '#F59E0B',
              borderRadius: 6,
            },
          }}
        />
        {adherence === 100 && (
          <Typography sx={{ textAlign: 'center', color: '#52B788', fontWeight: 700, mt: 1 }}>
            🎉 Tuyệt vời! Bạn đã uống đủ tất cả thuốc hôm nay!
          </Typography>
        )}
      </Box>

      {/* Filter toggle */}
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <FormControlLabel
          control={<Switch checked={showDone} onChange={e => setShowDone(e.target.checked)} color="primary" />}
          label={<Typography sx={{ fontSize: '0.9rem' }}>Hiện thuốc đã uống</Typography>}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Schedule list */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress size={52} /></Box>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {visibleSchedule.length === 0 ? (
            <HighContrastCard title="" accentColor="#52B788">
              <Box textAlign="center" py={5}>
                {schedule.length === 0 ? (
                  <>
                    <MedicationIcon sx={{ fontSize: '5rem', color: '#C8D8E8', mb: 2 }} />
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#5A6B7B' }}>
                      Chưa có đơn thuốc nào hôm nay
                    </Typography>
                    <Typography sx={{ color: '#A0ADB8', mt: 1, fontSize: '0.95rem' }}>
                      Người chăm sóc cần thêm đơn thuốc trước
                    </Typography>
                  </>
                ) : (
                  <>
                    <CheckCircleIcon sx={{ fontSize: '5rem', color: '#52B788', mb: 2 }} />
                    <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, color: '#52B788' }}>
                      Đã uống hết thuốc hôm nay! 🎉
                    </Typography>
                  </>
                )}
              </Box>
            </HighContrastCard>
          ) : (
            visibleSchedule.map(item => {
              const style = STATUS_STYLE[item.status] || STATUS_STYLE.PENDING;
              const isLate = isOverdue(item.scheduledTime, item.status);
              const isActioning = actionId === item.prescriptionItemId;

              return (
                <Box
                  key={item.prescriptionItemId}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    p: 2.5,
                    borderRadius: '16px',
                    bgcolor: isLate ? '#FFF1F2' : style.bg,
                    border: `2px solid ${isLate ? '#FDA4AF' : style.border}`,
                    transition: 'all 0.2s',
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                  }}
                >
                  {/* Time column */}
                  <Box
                    sx={{
                      minWidth: 70, textAlign: 'center',
                      p: 1.5, borderRadius: '12px',
                      bgcolor: item.status === 'TAKEN' ? '#52B78820' :
                        isLate ? '#E76F5120' : '#2E5C7F20',
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{
                      fontWeight: 800, fontSize: '1.2rem', lineHeight: 1,
                      color: item.status === 'TAKEN' ? '#52B788' :
                        isLate ? '#E76F51' : '#2E5C7F',
                    }}>
                      {item.scheduledTime}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#7A8B99', mt: 0.3 }}>
                      {isLate && item.status === 'PENDING' ? '⚠️ Trễ' : '⏰'}
                    </Typography>
                  </Box>

                  {/* Info column */}
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      <MedicationIcon sx={{
                        color: item.status === 'TAKEN' ? '#52B788' : '#2E5C7F',
                        fontSize: '1.3rem',
                      }} />
                      <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#2C3E50' }}>
                        {item.drugName}
                      </Typography>
                      <Chip
                        label={isLate && item.status === 'PENDING' ? 'Trễ ⚠️' : style.label}
                        color={isLate && item.status === 'PENDING' ? 'error' : style.chip as any}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </Box>

                    <Box display="flex" gap={1} mt={0.75} flexWrap="wrap">
                      {item.dosage && (
                        <Chip label={item.dosage} size="small" variant="outlined" sx={{ fontSize: '0.85rem' }} />
                      )}
                      {item.mealRelation && MEAL_LABELS[item.mealRelation] && (
                        <Chip label={MEAL_LABELS[item.mealRelation]} size="small" variant="outlined" sx={{ fontSize: '0.85rem' }} />
                      )}
                      {item.instructions && (
                        <Typography sx={{ fontSize: '0.85rem', color: '#7A8B99', mt: 0.3, fontStyle: 'italic' }}>
                          📋 {item.instructions}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Action buttons */}
                  {item.status === 'PENDING' && (
                    <Box display="flex" gap={1} flexShrink={0} alignSelf="center" flexWrap="wrap">
                      <ElderlyButton
                        color="success"
                        onClick={() => handleMark(item, 'TAKEN')}
                        disabled={!!actionId}
                        icon={isActioning
                          ? <CircularProgress size={18} color="inherit" />
                          : <CheckCircleIcon />}
                        sx={{ fontSize: '1rem' }}
                      >
                        Đã uống
                      </ElderlyButton>
                      <ElderlyButton
                        color="secondary"
                        variant="outlined"
                        onClick={() => handleMark(item, 'SKIPPED')}
                        disabled={!!actionId}
                        icon={<SkipNextIcon />}
                        sx={{ fontSize: '0.9rem' }}
                      >
                        Bỏ qua
                      </ElderlyButton>
                    </Box>
                  )}

                  {item.status === 'TAKEN' && (
                    <Box alignSelf="center" flexShrink={0}>
                      <CheckCircleIcon sx={{ fontSize: '2.5rem', color: '#52B788' }} />
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Box>
      )}

      {/* Tips section */}
      <Box mt={4} p={2.5} sx={{ bgcolor: '#F0F8FF', borderRadius: '16px', border: '2px solid #C8E6FA' }}>
        <Typography sx={{ fontWeight: 700, color: '#2E5C7F', mb: 1 }}>💡 Lưu ý quan trọng</Typography>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          {[
            'Uống thuốc đúng giờ giúp duy trì nồng độ thuốc ổn định trong máu.',
            'Không tự ý ngừng thuốc kể cả khi cảm thấy khoẻ hơn.',
            'Nếu quên uống thuốc, uống ngay khi nhớ ra (trừ khi gần đến giờ uống tiếp theo).',
            'Bật "Nhắc nhở" để nhận thông báo trình duyệt khi đến giờ uống thuốc.',
          ].map(tip => (
            <Typography key={tip} component="li" sx={{ fontSize: '0.9rem', color: '#5A6B7B', mb: 0.5 }}>
              {tip}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default MedicationSchedulePage;
