import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Chip, Alert, CircularProgress,
  LinearProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HighContrastCard from '../../components/common/HighContrastCard';
import ElderlyButton from '../../components/common/ElderlyButton';
import { healthService } from '../../services/healthService';
import { medicationService } from '../../services/medicationService';
import { useAuthStore } from '../../store/authStore';

interface MedScheduleItem {
  prescriptionItemId: string;
  drugName: string;
  dosage?: number;
  dosageUnit?: string;
  scheduledTime: string;
  status: 'PENDING' | 'TAKEN' | 'SKIPPED' | 'LATE';
  takenAt?: string;
  instructions?: string;
  mealRelation?: string;
}

interface DashboardData {
  vitals?: {
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    spo2?: number;
    temperature?: number;
    status?: string;
    measuredAt?: string;
  };
  medications: {
    schedule: MedScheduleItem[];
    total: number;
    taken: number;
    pending: number;
    adherenceRate: number;
  };
  appointments: {
    upcoming: Array<{
      id: string;
      doctorName: string;
      specialty?: string;
      hospitalName?: string;
      appointmentDate: string;
      appointmentType: string;
    }>;
    nextAppointment: any;
  };
  activity: {
    todaySteps: number;
    todayCalories: number;
    todayActiveMinutes: number;
    activitiesCount: number;
  };
  notifications: {
    unreadCount: number;
  };
}

const ElderlyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, getElderlyId } = useAuthStore();
  const elderlyId = getElderlyId() ?? '';

  const [currentTime, setCurrentTime] = useState(new Date());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!elderlyId) return;
    setLoading(true);
    setError('');
    try {
      const data = await healthService.getDashboard(elderlyId);
      setDashboard(data);
    } catch {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [elderlyId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleMarkTaken = async (item: MedScheduleItem) => {
    if (!elderlyId || markingId) return;
    setMarkingId(item.prescriptionItemId);
    try {
      const today = new Date().toISOString().split('T')[0];
      await medicationService.markTaken(
        item.prescriptionItemId,
        elderlyId,
        item.drugName,
        today,
        item.scheduledTime,
      );
      await loadDashboard();
    } catch {
      // ignore, dashboard will refresh on next load
    } finally {
      setMarkingId(null);
    }
  };

  const pending = dashboard?.medications.schedule.filter(m => m.status === 'PENDING') || [];
  const taken = dashboard?.medications.schedule.filter(m => m.status === 'TAKEN') || [];
  const adherence = dashboard?.medications.adherenceRate ?? 0;

  return (
    <Box>
      {/* Welcome Banner */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
          borderRadius: '24px',
          p: { xs: 3, md: 4 },
          mb: 3,
          color: 'white',
        }}
      >
        <Typography
          variant="h3"
          sx={{ fontWeight: 700, fontSize: { xs: '1.75rem', md: '2.5rem' }, mb: 1 }}
        >
          Xin chào, {user?.name?.split(' ').pop() || 'bạn'}! 👋
        </Typography>
        <Typography sx={{ fontSize: '1.1rem', opacity: 0.9, mb: 0.5 }}>
          Hôm nay là một ngày tuyệt vời để chăm sóc sức khỏe.
        </Typography>
        <Typography sx={{ fontSize: '1rem', opacity: 0.85 }}>
          🕐{' '}
          {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} —{' '}
          {currentTime.toLocaleDateString('vi-VN', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Typography>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: '16px' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress size={56} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* ── Unread Notifications Alert ── */}
          {(dashboard?.notifications?.unreadCount ?? 0) > 0 && (
            <Grid item xs={12}>
              <Alert
                severity="info"
                icon={<NotificationsIcon />}
                sx={{ borderRadius: '16px', fontSize: '1rem', cursor: 'pointer' }}
                onClick={() => navigate('/elderly/notifications')}
              >
                <Typography sx={{ fontWeight: 600 }}>
                  Bạn có {dashboard!.notifications.unreadCount} thông báo chưa đọc
                </Typography>
              </Alert>
            </Grid>
          )}

          {/* ── Upcoming Appointment ── */}
          {dashboard?.appointments?.nextAppointment && (
            <Grid item xs={12}>
              <Box
                sx={{
                  p: 2.5, borderRadius: '16px',
                  background: 'linear-gradient(135deg, #EBF4FB 0%, #F0F9FF 100%)',
                  border: '2px solid #C8E6FA',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: 2, cursor: 'pointer',
                }}
                onClick={() => navigate('/elderly/appointments')}
              >
                <Box display="flex" alignItems="center" gap={1.5}>
                  <CalendarMonthIcon sx={{ fontSize: '2rem', color: '#2E5C7F' }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#2E5C7F' }}>
                      Lịch hẹn sắp tới
                    </Typography>
                    <Typography sx={{ fontSize: '1rem', color: '#5A6B7B' }}>
                      {dashboard.appointments.nextAppointment.doctorName}
                      {dashboard.appointments.nextAppointment.specialty
                        ? ` — ${dashboard.appointments.nextAppointment.specialty}`
                        : ''}
                    </Typography>
                    <Typography sx={{ fontWeight: 600, color: '#2E5C7F', mt: 0.5 }}>
                      🕐{' '}
                      {new Date(dashboard.appointments.nextAppointment.appointmentDate).toLocaleString('vi-VN', {
                        weekday: 'long', day: 'numeric', month: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Typography>
                  </Box>
                </Box>
                <Chip label="Xem tất cả" color="primary" sx={{ fontWeight: 600 }} />
              </Box>
            </Grid>
          )}

          {/* ── Pending Medications ── */}
          <Grid item xs={12} md={8}>
            <HighContrastCard
              title={`💊 Chưa uống hôm nay (${pending.length} thuốc)`}
              accentColor="#E88D5D"
            >
              {pending.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <CheckCircleIcon sx={{ fontSize: '4rem', color: '#52B788', mb: 1 }} />
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#52B788' }}>
                    Tuyệt vời! Bạn đã uống đủ thuốc hôm nay!
                  </Typography>
                </Box>
              ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                  {pending.map((med) => (
                    <Box
                      key={`${med.prescriptionItemId}-${med.scheduledTime}`}
                      sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        p: 2.5, bgcolor: '#FFF8F3', borderRadius: '14px',
                        border: '2px solid #F4C8A6',
                        flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 2,
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#2C3E50' }}>
                          {med.drugName}
                          {med.dosage ? ` — ${med.dosage}${med.dosageUnit || 'mg'}` : ''}
                        </Typography>
                        <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                          <Chip
                            icon={<AccessTimeIcon />}
                            label={med.scheduledTime}
                            size="small"
                            sx={{ fontWeight: 600, fontSize: '0.9rem' }}
                          />
                          {med.mealRelation && (
                            <Chip
                              label={med.mealRelation === 'BEFORE_MEAL' ? 'Trước ăn' :
                                med.mealRelation === 'AFTER_MEAL' ? 'Sau ăn' : 'Khi ăn'}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.9rem' }}
                            />
                          )}
                        </Box>
                        {med.instructions && (
                          <Typography sx={{ fontSize: '0.85rem', color: '#7A8B99', mt: 0.5 }}>
                            📋 {med.instructions}
                          </Typography>
                        )}
                      </Box>
                      <ElderlyButton
                        color="success"
                        onClick={() => handleMarkTaken(med)}
                        icon={markingId === med.prescriptionItemId
                          ? <CircularProgress size={18} color="inherit" />
                          : <CheckCircleIcon />}
                        disabled={!!markingId}
                        sx={{ flexShrink: 0 }}
                      >
                        Đã uống
                      </ElderlyButton>
                    </Box>
                  ))}
                </Box>
              )}
            </HighContrastCard>
          </Grid>

          {/* ── Right Column ── */}
          <Grid item xs={12} md={4}>
            {/* Today's progress */}
            <HighContrastCard title="📊 Tiến độ hôm nay" accentColor="#52B788">
              <Box textAlign="center" py={1}>
                <Typography
                  sx={{ fontSize: '4rem', fontWeight: 700, color: '#52B788', lineHeight: 1 }}
                >
                  {taken.length}/{(dashboard?.medications.total ?? 0)}
                </Typography>
                <Typography sx={{ fontSize: '1.1rem', color: '#7A8B99', mt: 1 }}>
                  Thuốc đã uống
                </Typography>
                <Box mt={2} px={1}>
                  <LinearProgress
                    variant="determinate"
                    value={adherence}
                    sx={{
                      height: 10, borderRadius: 5,
                      bgcolor: '#E8F5EE',
                      '& .MuiLinearProgress-bar': { bgcolor: '#52B788', borderRadius: 5 },
                    }}
                  />
                </Box>
                <Chip
                  label={`${adherence}% hoàn thành`}
                  color="success"
                  sx={{ mt: 1.5, fontWeight: 700, fontSize: '1rem' }}
                />
              </Box>
            </HighContrastCard>

            {/* Vital signs */}
            <Box mt={3}>
              <HighContrastCard title="❤️ Chỉ số sức khoẻ" accentColor="#4A8FB8">
                {dashboard?.vitals ? (
                  <Box display="flex" flexDirection="column" gap={2}>
                    {[
                      {
                        icon: '❤️', label: 'Nhịp tim',
                        value: dashboard.vitals.heartRate
                          ? `${dashboard.vitals.heartRate} BPM` : '—',
                      },
                      {
                        icon: '🩺', label: 'Huyết áp',
                        value: dashboard.vitals.bloodPressureSystolic
                          ? `${dashboard.vitals.bloodPressureSystolic}/${dashboard.vitals.bloodPressureDiastolic}`
                          : '—',
                      },
                      {
                        icon: '💧', label: 'SpO2',
                        value: dashboard.vitals.spo2 ? `${dashboard.vitals.spo2}%` : '—',
                      },
                      {
                        icon: '🌡️', label: 'Nhiệt độ',
                        value: dashboard.vitals.temperature
                          ? `${dashboard.vitals.temperature}°C` : '—',
                      },
                    ].filter(v => v.value !== '—').map((item) => (
                      <Box
                        key={item.label}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          p: 1.5, bgcolor: '#F0F8FF', borderRadius: '12px',
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography sx={{ fontSize: '1.5rem' }}>{item.icon}</Typography>
                          <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: '1rem' }}>
                              {item.value}
                            </Typography>
                            <Typography sx={{ fontSize: '0.85rem', color: '#7A8B99' }}>
                              {item.label}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          label={dashboard.vitals?.status === 'NORMAL' ? 'Bình thường'
                            : dashboard.vitals?.status === 'WARNING' ? 'Cảnh báo' : 'Nguy hiểm'}
                          color={dashboard.vitals?.status === 'NORMAL' ? 'success'
                            : dashboard.vitals?.status === 'WARNING' ? 'warning' : 'error'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                    ))}
                    {dashboard.vitals.measuredAt && (
                      <Typography sx={{ fontSize: '0.8rem', color: '#A0ADB8', textAlign: 'right' }}>
                        Cập nhật: {new Date(dashboard.vitals.measuredAt).toLocaleString('vi-VN', {
                          day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Box textAlign="center" py={2}>
                    <FavoriteIcon sx={{ fontSize: '3rem', color: '#C8D8E8', mb: 1 }} />
                    <Typography sx={{ color: '#A0ADB8', fontSize: '0.95rem' }}>
                      Chưa có dữ liệu đo gần đây
                    </Typography>
                    <ElderlyButton
                      sx={{ mt: 2, fontSize: '0.9rem' }}
                      onClick={() => navigate('/elderly/health-check')}
                    >
                      Đo ngay
                    </ElderlyButton>
                  </Box>
                )}
              </HighContrastCard>
            </Box>

            {/* Today's Activity */}
            <Box mt={3}>
              <HighContrastCard title="🏃 Vận động hôm nay" accentColor="#52B788">
                <Box
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate('/elderly/activity')}
                >
                  {(dashboard?.activity?.activitiesCount ?? 0) > 0 ? (
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      {[
                        { label: '🦶 Bước chân', value: (dashboard!.activity.todaySteps || 0).toLocaleString() },
                        { label: '⏱️ Thời gian', value: `${dashboard!.activity.todayActiveMinutes} phút` },
                        { label: '🔥 Calories', value: `${dashboard!.activity.todayCalories} kcal` },
                      ].map(item => (
                        <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#F8FDF9', borderRadius: '10px' }}>
                          <Typography sx={{ fontSize: '0.95rem', color: '#5A6B7B' }}>{item.label}</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#52B788' }}>{item.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Box textAlign="center" py={2}>
                      <DirectionsWalkIcon sx={{ fontSize: '3rem', color: '#C8E6D0', mb: 1 }} />
                      <Typography sx={{ color: '#A0ADB8', fontSize: '0.95rem' }}>
                        Chưa có hoạt động hôm nay
                      </Typography>
                      <Typography sx={{ color: '#C8D8E8', fontSize: '0.85rem', mt: 0.5 }}>
                        Nhấn để ghi nhận
                      </Typography>
                    </Box>
                  )}
                </Box>
              </HighContrastCard>
            </Box>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ElderlyDashboard;
