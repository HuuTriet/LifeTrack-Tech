import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Grid, Typography, Chip, Alert, CircularProgress,
  LinearProgress, Avatar, Paper, IconButton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import MedicationIcon from '@mui/icons-material/Medication';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import StarIcon from '@mui/icons-material/Star';
import ElderlyButton from '../../components/common/ElderlyButton';
import { healthService } from '../../services/healthService';
import { medicationService } from '../../services/medicationService';
import { useAuthStore } from '../../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MedScheduleItem {
  prescriptionItemId: string;
  drugName: string;
  dosage?: number;
  dosageUnit?: string;
  scheduledTime: string;
  status: 'PENDING' | 'TAKEN' | 'SKIPPED' | 'LATE';
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
  appointments: { upcoming: any[]; nextAppointment: any };
  activity: { todaySteps: number; todayCalories: number; todayActiveMinutes: number; activitiesCount: number };
  notifications: { unreadCount: number };
}

// ── Health tips ───────────────────────────────────────────────────────────────

const HEALTH_TIPS = [
  { icon: '💧', text: 'Uống ít nhất 8 ly nước mỗi ngày để giữ cho cơ thể đủ nước.' },
  { icon: '🚶', text: 'Đi bộ 30 phút mỗi ngày giúp giảm nguy cơ bệnh tim mạch đến 35%.' },
  { icon: '😴', text: 'Ngủ đủ 7–8 tiếng mỗi đêm giúp tăng cường hệ miễn dịch và trí nhớ.' },
  { icon: '🥗', text: 'Ăn nhiều rau xanh và trái cây giúp bổ sung vitamin thiết yếu cho cơ thể.' },
  { icon: '🧘', text: 'Thực hành thiền định 10 phút mỗi ngày giúp giảm căng thẳng hiệu quả.' },
  { icon: '💊', text: 'Uống thuốc đúng giờ mỗi ngày giúp duy trì nồng độ thuốc ổn định trong máu.' },
  { icon: '☀️', text: 'Tắm nắng buổi sáng 15–20 phút giúp cơ thể tổng hợp Vitamin D tự nhiên.' },
];

// ── Animated Counter Hook ─────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
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

// ── Radial Progress (SVG) ─────────────────────────────────────────────────────

const RadialProgress: React.FC<{ value: number; size?: number; color?: string; label?: string }> = ({
  value, size = 88, color = '#2E5C7F', label,
}) => {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <Box position="relative" display="inline-flex" alignItems="center" justifyContent="center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }}
        />
      </svg>
      <Box position="absolute" textAlign="center">
        <Typography sx={{ fontWeight: 800, fontSize: size > 80 ? '1.3rem' : '1rem', color, lineHeight: 1 }}>
          {value}%
        </Typography>
        {label && <Typography sx={{ fontSize: '0.65rem', color: '#64748B', mt: 0.2 }}>{label}</Typography>}
      </Box>
    </Box>
  );
};

// ── Vital Card ────────────────────────────────────────────────────────────────

const VitalCard: React.FC<{
  icon: React.ReactNode; label: string; value: string; unit?: string;
  status?: string; color: string; bg: string; delay?: number;
}> = ({ icon, label, value, unit, status, color, bg, delay = 0 }) => (
  <Paper elevation={0} sx={{
    p: 2.5, borderRadius: '18px',
    border: `1.5px solid ${color}25`,
    bgcolor: bg,
    display: 'flex', flexDirection: 'column', gap: 1,
    transition: 'all 0.3s ease',
    '&:hover': { boxShadow: `0 8px 30px ${color}25`, transform: 'translateY(-4px)' },
    '@keyframes slideUp': {
      from: { opacity: 0, transform: 'translateY(20px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    animation: `slideUp 0.5s ease ${delay}s both`,
  }}>
    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
      <Box sx={{
        width: 44, height: 44, borderRadius: '12px',
        bgcolor: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </Box>
      {status && (
        <Chip
          label={status === 'NORMAL' ? 'Bình thường' : status === 'WARNING' ? 'Cảnh báo' : 'Nguy hiểm'}
          size="small"
          sx={{
            fontWeight: 700, fontSize: '0.75rem',
            bgcolor: status === 'NORMAL' ? '#DCFCE7' : status === 'WARNING' ? '#FEF9C3' : '#FEE2E2',
            color: status === 'NORMAL' ? '#15803D' : status === 'WARNING' ? '#854D0E' : '#B91C1C',
          }}
        />
      )}
    </Box>
    <Box>
      <Box display="flex" alignItems="baseline" gap={0.5}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color, lineHeight: 1 }}>{value}</Typography>
        {unit && <Typography sx={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>{unit}</Typography>}
      </Box>
      <Typography sx={{ fontSize: '0.85rem', color: '#64748B', mt: 0.3 }}>{label}</Typography>
    </Box>
  </Paper>
);

// ── Quick Action Button ───────────────────────────────────────────────────────

const QuickAction: React.FC<{ icon: string; label: string; color: string; onClick: () => void; delay?: number }> = ({
  icon, label, color, onClick, delay = 0,
}) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
      p: 1.5, borderRadius: '16px', cursor: 'pointer', minWidth: 72,
      bgcolor: '#FFFFFF', border: '1.5px solid #E8F0F7',
      transition: 'all 0.25s ease',
      '&:hover': { bgcolor: `${color}10`, borderColor: color, transform: 'translateY(-4px)', boxShadow: `0 8px 24px ${color}25` },
      '@keyframes popIn': {
        from: { opacity: 0, transform: 'scale(0.8)' },
        to: { opacity: 1, transform: 'scale(1)' },
      },
      animation: `popIn 0.4s ease ${delay}s both`,
    }}
  >
    <Typography sx={{ fontSize: '1.6rem' }}>{icon}</Typography>
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', textAlign: 'center', lineHeight: 1.2 }}>
      {label}
    </Typography>
  </Box>
);

// ── Main Component ────────────────────────────────────────────────────────────

const ElderlyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, getElderlyId } = useAuthStore();
  const elderlyId = getElderlyId() ?? '';

  const [currentTime, setCurrentTime] = useState(new Date());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Rotate health tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex(i => (i + 1) % HEALTH_TIPS.length);
        setTipVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
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
      await medicationService.markTaken(item.prescriptionItemId, elderlyId, item.drugName, today, item.scheduledTime);
      await loadDashboard();
    } catch { /* ignore */ } finally {
      setMarkingId(null);
    }
  };

  const pending = dashboard?.medications.schedule.filter(m => m.status === 'PENDING') || [];
  const taken = dashboard?.medications.schedule.filter(m => m.status === 'TAKEN') || [];
  const adherence = dashboard?.medications.adherenceRate ?? 0;
  const vitals = dashboard?.vitals;

  // Animated counters
  const stepsCount = useCountUp(dashboard?.activity?.todaySteps ?? 0);
  const caloriesCount = useCountUp(dashboard?.activity?.todayCalories ?? 0);

  const greeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  // Daily health score
  const healthScore = Math.round(
    (adherence * 0.4) +
    (vitals?.status === 'NORMAL' ? 30 : 10) +
    ((dashboard?.activity?.activitiesCount ?? 0) > 0 ? 30 : 0)
  );

  const tip = HEALTH_TIPS[tipIndex];

  return (
    <Box sx={{
      '@keyframes fadeInPage': { from: { opacity: 0 }, to: { opacity: 1 } },
      animation: 'fadeInPage 0.4s ease',
    }}>

      {/* ── HERO SECTION ───────────────────────────────────────────────────── */}
      <Box sx={{
        position: 'relative', borderRadius: '28px', overflow: 'hidden',
        mb: 3, minHeight: { xs: 220, md: 270 },
      }}>
        <Box
          component="img"
          src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1400&q=80"
          alt="Health"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(110deg, rgba(0,60,120,0.92) 0%, rgba(0,120,200,0.68) 55%, rgba(0,80,140,0.3) 100%)',
        }} />

        {/* Decorative animated orbs */}
        {[
          { size: 160, top: -40, right: -40, opacity: 0.06, delay: 0 },
          { size: 100, top: 60, right: 80, opacity: 0.05, delay: 1 },
          { size: 70, bottom: -20, left: 60, opacity: 0.07, delay: 2 },
        ].map((orb, i) => (
          <Box key={i} sx={{
            position: 'absolute',
            width: orb.size, height: orb.size, borderRadius: '50%',
            bgcolor: 'white', opacity: orb.opacity,
            top: orb.top, right: (orb as any).right, bottom: (orb as any).bottom, left: (orb as any).left,
            '@keyframes floatOrb': {
              '0%': { transform: 'translateY(0px) scale(1)' },
              '50%': { transform: 'translateY(-12px) scale(1.05)' },
              '100%': { transform: 'translateY(0px) scale(1)' },
            },
            animation: `floatOrb ${4 + orb.delay}s ease-in-out infinite`,
          }} />
        ))}

        {/* Content */}
        <Box sx={{ position: 'relative', p: { xs: 3, md: 4 }, color: 'white' }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{
              width: 60, height: 60,
              bgcolor: 'rgba(255,255,255,0.22)',
              border: '2px solid rgba(255,255,255,0.5)',
              fontSize: '1.5rem', fontWeight: 700,
              '@keyframes avatarPulse': {
                '0%': { boxShadow: '0 0 0 0 rgba(255,255,255,0.4)' },
                '70%': { boxShadow: '0 0 0 12px rgba(255,255,255,0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(255,255,255,0)' },
              },
              animation: 'avatarPulse 2.5s ease-out infinite',
            }}>
              {user?.name?.slice(0, 1).toUpperCase() || 'U'}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: '0.9rem', opacity: 0.8 }}>{greeting()},</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.9rem' }, lineHeight: 1.1 }}>
                {user?.name?.split(' ').pop() || 'Bạn'} 👋
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography sx={{ fontSize: '0.95rem', opacity: 0.85 }}>
              Hôm nay là một ngày tuyệt vời để chăm sóc sức khoẻ.
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.9rem', opacity: 0.72 }}>
            🕐 {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {' '}
            {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>

          {/* Stats pills */}
          <Box display="flex" gap={2} mt={2.5} flexWrap="wrap">
            {[
              { icon: '💊', label: 'Chờ uống', value: pending.length, color: '#FDE68A', text: '#92400E' },
              { icon: '✅', label: 'Đã uống', value: taken.length, color: '#D1FAE5', text: '#065F46' },
              { icon: '📅', label: 'Lịch hẹn', value: dashboard?.appointments?.upcoming?.length ?? 0, color: '#DBEAFE', text: '#1E40AF' },
              { icon: '🦶', label: 'Bước chân', value: stepsCount.toLocaleString(), color: '#FCE7F3', text: '#831843' },
            ].map((s, i) => (
              <Box key={s.label} sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                bgcolor: s.color, borderRadius: '50px', px: 1.75, py: 0.6,
                '@keyframes slideInChip': {
                  from: { opacity: 0, transform: 'translateX(-10px)' },
                  to: { opacity: 1, transform: 'translateX(0)' },
                },
                animation: `slideInChip 0.4s ease ${i * 0.1}s both`,
              }}>
                <Typography sx={{ fontSize: '0.85rem' }}>{s.icon}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: s.text }}>
                  {s.value} {s.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── HEALTH TIP BANNER ──────────────────────────────────────────────── */}
      <Box sx={{
        mb: 2.5, p: 2, borderRadius: '18px',
        background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)',
        border: '1.5px solid #BFDBFE',
        display: 'flex', alignItems: 'center', gap: 1.5,
        overflow: 'hidden',
      }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
          bgcolor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center',
          '@keyframes rotateTip': {
            '0%': { transform: 'rotate(0deg)' },
            '25%': { transform: 'rotate(-5deg)' },
            '75%': { transform: 'rotate(5deg)' },
            '100%': { transform: 'rotate(0deg)' },
          },
          animation: 'rotateTip 2s ease-in-out infinite',
        }}>
          <LightbulbIcon sx={{ color: '#1D4ED8', fontSize: '1.4rem' }} />
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#3B82F6', mb: 0.2 }}>
            MẸO SỨC KHOẺ HÔM NAY
          </Typography>
          <Typography sx={{
            fontSize: '0.9rem', color: '#1E293B', fontWeight: 500,
            opacity: tipVisible ? 1 : 0,
            transform: tipVisible ? 'translateX(0)' : 'translateX(10px)',
            transition: 'all 0.4s ease',
          }}>
            {tip.icon} {tip.text}
          </Typography>
        </Box>
        <Box display="flex" gap={0.5}>
          {HEALTH_TIPS.map((_, i) => (
            <Box key={i} sx={{
              width: i === tipIndex ? 16 : 6, height: 6, borderRadius: '3px',
              bgcolor: i === tipIndex ? '#3B82F6' : '#BFDBFE',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </Box>
      </Box>

      {/* ── QUICK ACTIONS ──────────────────────────────────────────────────── */}
      <Box mb={3}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B', mb: 1.5 }}>
          ⚡ Thao tác nhanh
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5 }}>
          {[
            { icon: '💊', label: 'Thêm thuốc', color: '#E76F51', path: '/elderly/medications', delay: 0 },
            { icon: '❤️', label: 'Đo sức khoẻ', color: '#E53E3E', path: '/elderly/health-check', delay: 0.05 },
            { icon: '📅', label: 'Đặt lịch', color: '#3B82F6', path: '/elderly/appointments', delay: 0.1 },
            { icon: '🏃', label: 'Ghi vận động', color: '#059669', path: '/elderly/activity', delay: 0.15 },
            { icon: '📊', label: 'Thống kê', color: '#7C3AED', path: '/elderly/health-check', delay: 0.2 },
          ].map(a => (
            <QuickAction key={a.label} icon={a.icon} label={a.label} color={a.color} delay={a.delay} onClick={() => navigate(a.path)} />
          ))}
        </Box>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 3, borderRadius: '16px' }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" flexDirection="column" alignItems="center" py={8} gap={2}>
          <CircularProgress size={52} sx={{ color: '#2E5C7F' }} />
          <Typography sx={{ color: '#64748B' }}>Đang tải dữ liệu sức khoẻ...</Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>

          {/* ── HEALTH SCORE + VITALS ──────────────────────────────────────── */}
          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#1E293B' }}>
                📊 Chỉ số sức khoẻ gần nhất
              </Typography>
              <Box
                onClick={() => navigate('/elderly/health-check')}
                sx={{ fontSize: '0.9rem', color: '#0077B6', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                Đo mới <ArrowForwardIosIcon sx={{ fontSize: '0.8rem' }} />
              </Box>
            </Box>

            {vitals ? (
              <Grid container spacing={1.5}>
                {[
                  { icon: <MonitorHeartIcon sx={{ fontSize: '1.5rem', color: '#E53E3E' }} />, label: 'Huyết áp', value: vitals.bloodPressureSystolic ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}` : '—', unit: 'mmHg', color: '#E53E3E', bg: '#FFF5F5', status: vitals.status, delay: 0 },
                  { icon: <FavoriteIcon sx={{ fontSize: '1.5rem', color: '#DD6B20' }} />, label: 'Nhịp tim', value: vitals.heartRate ? `${vitals.heartRate}` : '—', unit: 'bpm', color: '#DD6B20', bg: '#FFFAF0', status: undefined, delay: 0.08 },
                  { icon: <WaterDropIcon sx={{ fontSize: '1.5rem', color: '#3182CE' }} />, label: 'SpO₂', value: vitals.spo2 ? `${vitals.spo2}` : '—', unit: '%', color: '#3182CE', bg: '#EBF8FF', status: undefined, delay: 0.16 },
                  { icon: <ThermostatIcon sx={{ fontSize: '1.5rem', color: '#38A169' }} />, label: 'Nhiệt độ', value: vitals.temperature ? `${vitals.temperature}` : '—', unit: '°C', color: '#38A169', bg: '#F0FFF4', status: undefined, delay: 0.24 },
                ].map((v) => (
                  <Grid item xs={6} sm={3} key={v.label}>
                    <VitalCard {...v} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box
                onClick={() => navigate('/elderly/health-check')}
                sx={{
                  p: 3, borderRadius: '18px', cursor: 'pointer',
                  border: '2px dashed #CBD5E1', textAlign: 'center',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#0077B6', bgcolor: '#F0F9FF', transform: 'scale(1.01)' },
                }}
              >
                <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>🩺</Typography>
                <Typography sx={{ color: '#64748B', fontWeight: 600 }}>Chưa có dữ liệu sức khoẻ hôm nay</Typography>
                <Typography sx={{ color: '#0077B6', fontWeight: 700, mt: 0.5 }}>+ Đo ngay →</Typography>
              </Box>
            )}
          </Grid>

          {/* ── DAILY HEALTH SCORE CARD ────────────────────────────────────── */}
          <Grid item xs={12} sm={4}>
            <Paper elevation={0} sx={{
              borderRadius: '20px', border: '1.5px solid #E2E8F0',
              background: 'linear-gradient(135deg, #F0F9FF 0%, #EFF6FF 100%)',
              p: 2.5, height: '100%',
              '@keyframes fadeCard': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              animation: 'fadeCard 0.5s ease 0.2s both',
            }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <StarIcon sx={{ color: '#F59E0B', fontSize: '1.3rem' }} />
                <Typography sx={{ fontWeight: 700, color: '#1E293B' }}>Điểm sức khoẻ hôm nay</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={3}>
                <RadialProgress value={healthScore} color={healthScore >= 70 ? '#059669' : healthScore >= 40 ? '#D97706' : '#E53E3E'} label="điểm" />
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '2rem', color: healthScore >= 70 ? '#059669' : '#D97706', lineHeight: 1 }}>
                    {healthScore}
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: '#64748B', mt: 0.3 }}>/ 100 điểm</Typography>
                  <Chip
                    label={healthScore >= 70 ? '🌟 Rất tốt' : healthScore >= 50 ? '👍 Tốt' : '⚠️ Cần cải thiện'}
                    size="small"
                    sx={{ mt: 1, fontWeight: 700, bgcolor: healthScore >= 70 ? '#D1FAE5' : '#FEF3C7', color: healthScore >= 70 ? '#065F46' : '#92400E' }}
                  />
                </Box>
              </Box>
              {/* Score breakdown */}
              <Box mt={2} display="flex" flexDirection="column" gap={1}>
                {[
                  { label: 'Uống thuốc', val: Math.round(adherence * 0.4), max: 40, color: '#3B82F6' },
                  { label: 'Chỉ số sinh hiệu', val: vitals?.status === 'NORMAL' ? 30 : 10, max: 30, color: '#E53E3E' },
                  { label: 'Vận động', val: (dashboard?.activity?.activitiesCount ?? 0) > 0 ? 30 : 0, max: 30, color: '#059669' },
                ].map(row => (
                  <Box key={row.label}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.78rem', color: '#64748B' }}>{row.label}</Typography>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: row.color }}>{row.val}/{row.max}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={(row.val / row.max) * 100} sx={{
                      height: 5, borderRadius: 3, bgcolor: `${row.color}20`,
                      '& .MuiLinearProgress-bar': { bgcolor: row.color, borderRadius: 3 },
                    }} />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* ── MEDICATIONS ────────────────────────────────────────────────── */}
          <Grid item xs={12} sm={8}>
            <Paper elevation={0} sx={{
              borderRadius: '20px', border: '1.5px solid #E2E8F0', overflow: 'hidden',
              '@keyframes fadeCard': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              animation: 'fadeCard 0.5s ease 0.3s both',
            }}>
              <Box sx={{
                position: 'relative', height: 80, overflow: 'hidden',
                background: 'linear-gradient(135deg, #E76F51 0%, #C0532A 100%)',
              }}>
                <Box component="img"
                  src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=60"
                  alt="Medications"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.2 }}
                />
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', px: 3, gap: 1.5 }}>
                  <MedicationIcon sx={{ color: 'white', fontSize: '1.8rem' }} />
                  <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>
                    💊 Thuốc cần uống hôm nay
                  </Typography>
                  <Chip label={`${pending.length} chờ`} sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700 }} />
                </Box>
              </Box>

              <Box sx={{ p: 2.5 }}>
                {/* Progress */}
                <Box mb={2.5}>
                  <Box display="flex" justifyContent="space-between" mb={0.75} alignItems="center">
                    <Typography sx={{ fontSize: '0.9rem', color: '#475569' }}>Tiến độ hôm nay</Typography>
                    <Box display="flex" alignItems="center" gap={0.75}>
                      <TrendingUpIcon sx={{ fontSize: '1rem', color: adherence >= 70 ? '#16A34A' : '#D97706' }} />
                      <Typography sx={{ fontWeight: 700, color: adherence === 100 ? '#16A34A' : '#0077B6', fontSize: '1rem' }}>{adherence}%</Typography>
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" value={adherence} sx={{
                    height: 10, borderRadius: 5, bgcolor: '#E2E8F0',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                      bgcolor: adherence === 100 ? '#16A34A' : adherence > 60 ? '#0077B6' : '#F59E0B',
                      transition: 'width 1s ease',
                    },
                  }} />
                  <Box display="flex" justifyContent="space-between" mt={0.5}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>{taken.length} đã uống</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>{pending.length} còn lại</Typography>
                  </Box>
                </Box>

                {pending.length === 0 ? (
                  <Box textAlign="center" py={3}>
                    <Box sx={{
                      width: 72, height: 72, borderRadius: '50%',
                      bgcolor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mx: 'auto', mb: 1.5,
                      '@keyframes checkBounce': {
                        '0%': { transform: 'scale(0)' },
                        '60%': { transform: 'scale(1.15)' },
                        '100%': { transform: 'scale(1)' },
                      },
                      animation: 'checkBounce 0.6s ease',
                    }}>
                      <CheckCircleIcon sx={{ fontSize: '2.5rem', color: '#16A34A' }} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#16A34A' }}>
                      Tuyệt vời! Đã uống đủ thuốc hôm nay! 🎉
                    </Typography>
                  </Box>
                ) : (
                  <Box display="flex" flexDirection="column" gap={1.25}>
                    {pending.slice(0, 3).map((med, idx) => (
                      <Box key={`${med.prescriptionItemId}-${med.scheduledTime}`} sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        p: 1.75, bgcolor: '#FFF7ED', borderRadius: '14px',
                        border: '1.5px solid #FED7AA',
                        flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1.25,
                        '@keyframes slideRow': { from: { opacity: 0, transform: 'translateX(-12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                        animation: `slideRow 0.4s ease ${idx * 0.1}s both`,
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: '#FFF0DB', transform: 'translateX(4px)' },
                      }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <MedicationIcon sx={{ color: '#D97706', fontSize: '1.3rem' }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1E293B' }}>
                              {med.drugName}{med.dosage ? ` ${med.dosage}${med.dosageUnit || 'mg'}` : ''}
                            </Typography>
                            <Box display="flex" gap={0.5} mt={0.3}>
                              <Chip icon={<AccessTimeIcon />} label={med.scheduledTime} size="small" sx={{ fontSize: '0.78rem', fontWeight: 600 }} />
                            </Box>
                          </Box>
                        </Box>
                        <ElderlyButton
                          color="success"
                          onClick={() => handleMarkTaken(med)}
                          icon={markingId === med.prescriptionItemId ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                          disabled={!!markingId}
                          sx={{ flexShrink: 0, fontSize: '0.88rem', py: 0.8 }}
                        >
                          Đã uống
                        </ElderlyButton>
                      </Box>
                    ))}
                    {pending.length > 3 && (
                      <Typography sx={{ fontSize: '0.85rem', color: '#94A3B8', textAlign: 'center' }}>
                        + {pending.length - 3} thuốc khác...
                      </Typography>
                    )}
                  </Box>
                )}

                <Box
                  onClick={() => navigate('/elderly/medications')}
                  sx={{ mt: 2, pt: 2, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Typography sx={{ fontSize: '0.9rem', color: '#0077B6', fontWeight: 600 }}>
                    Xem tất cả lịch uống thuốc →
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* ── ACTIVITY SUMMARY ────────────────────────────────────────────── */}
          <Grid item xs={12} sm={6}>
            <Paper elevation={0} sx={{
              borderRadius: '20px', border: '1.5px solid #E2E8F0', overflow: 'hidden',
              '@keyframes fadeCard': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              animation: 'fadeCard 0.5s ease 0.4s both',
            }}>
              <Box sx={{ position: 'relative', height: 76, overflow: 'hidden' }}>
                <Box component="img"
                  src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=60"
                  alt="Activity" sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
                />
                <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(5,150,105,0.85) 0%, rgba(16,185,129,0.5) 100%)', display: 'flex', alignItems: 'center', px: 3, gap: 1.5 }}>
                  <DirectionsWalkIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
                  <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Vận động hôm nay</Typography>
                </Box>
              </Box>
              <Box sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate('/elderly/activity')}>
                <Grid container spacing={1.5}>
                  {[
                    { icon: '🦶', label: 'Bước chân', value: stepsCount.toLocaleString(), sub: '/ 7.000 mục tiêu', color: '#059669' },
                    { icon: '⏱️', label: 'Thời gian', value: `${dashboard?.activity?.todayActiveMinutes ?? 0}`, sub: 'phút vận động', color: '#0077B6' },
                    { icon: '🔥', label: 'Calories', value: caloriesCount.toString(), sub: 'kcal tiêu thụ', color: '#D97706' },
                  ].map((s, i) => (
                    <Grid item xs={4} key={s.label}>
                      <Box textAlign="center" sx={{
                        p: 1.25, bgcolor: '#F8FAFC', borderRadius: '12px',
                        transition: 'all 0.25s', cursor: 'pointer',
                        '&:hover': { bgcolor: '#EFF6FF', transform: 'scale(1.04)' },
                        '@keyframes countUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                        animation: `countUp 0.4s ease ${i * 0.1}s both`,
                      }}>
                        <Typography sx={{ fontSize: '1.3rem' }}>{s.icon}</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: s.color }}>{s.value}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94A3B8', lineHeight: 1.2 }}>{s.sub}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                {/* Step progress bar */}
                <Box mt={1.5}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(((dashboard?.activity?.todaySteps ?? 0) / 7000) * 100, 100)}
                    sx={{ height: 8, borderRadius: 4, bgcolor: '#D1FAE5', '& .MuiLinearProgress-bar': { bgcolor: '#059669', borderRadius: 4 } }}
                  />
                  <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mt: 0.4, textAlign: 'right' }}>
                    {Math.round(((dashboard?.activity?.todaySteps ?? 0) / 7000) * 100)}% mục tiêu
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* ── UPCOMING APPOINTMENT ────────────────────────────────────────── */}
          <Grid item xs={12} sm={6}>
            {dashboard?.appointments?.nextAppointment ? (
              <Paper elevation={0} sx={{
                borderRadius: '20px', border: '1.5px solid #E2E8F0', overflow: 'hidden',
                '@keyframes fadeCard': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                animation: 'fadeCard 0.5s ease 0.5s both',
              }}>
                <Box sx={{ position: 'relative', height: 76, overflow: 'hidden' }}>
                  <Box component="img"
                    src="https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&q=60"
                    alt="Doctor" sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,80,140,0.85) 0%, rgba(0,140,200,0.5) 100%)', display: 'flex', alignItems: 'center', px: 3, gap: 1.5 }}>
                    <CalendarMonthIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
                    <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Lịch hẹn sắp tới</Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate('/elderly/appointments')}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B' }}>
                    {dashboard.appointments.nextAppointment.doctorName}
                  </Typography>
                  <Box sx={{ mt: 1.25, p: 1.25, bgcolor: '#EFF6FF', borderRadius: '10px' }}>
                    <Typography sx={{ fontWeight: 700, color: '#1D4ED8', fontSize: '0.9rem' }}>
                      📅 {new Date(dashboard.appointments.nextAppointment.appointmentDate).toLocaleString('vi-VN', {
                        weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </Typography>
                  </Box>
                  {/* Days until */}
                  {(() => {
                    const daysUntil = Math.ceil((new Date(dashboard.appointments.nextAppointment.appointmentDate).getTime() - Date.now()) / 86400000);
                    return daysUntil > 0 ? (
                      <Chip
                        icon={<AccessTimeIcon />}
                        label={`Còn ${daysUntil} ngày nữa`}
                        size="small"
                        sx={{ mt: 1, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }}
                      />
                    ) : null;
                  })()}
                </Box>
              </Paper>
            ) : (
              <Paper elevation={0} sx={{
                borderRadius: '20px', border: '2px dashed #CBD5E1', overflow: 'hidden',
                cursor: 'pointer', transition: 'all 0.2s',
                '&:hover': { borderColor: '#0077B6', bgcolor: '#F0F9FF' },
                '@keyframes fadeCard': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                animation: 'fadeCard 0.5s ease 0.5s both',
              }} onClick={() => navigate('/elderly/appointments')}>
                <Box component="img"
                  src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=60"
                  alt="Doctor" sx={{ width: '100%', height: 130, objectFit: 'cover', objectPosition: 'center 20%' }}
                />
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 600, color: '#64748B', fontSize: '0.95rem' }}>Chưa có lịch hẹn nào</Typography>
                  <Typography sx={{ color: '#0077B6', fontWeight: 700, fontSize: '0.9rem', mt: 0.5 }}>+ Đặt lịch ngay →</Typography>
                </Box>
              </Paper>
            )}
          </Grid>

          {/* ── MOTIVATIONAL BANNER ─────────────────────────────────────────── */}
          <Grid item xs={12}>
            <Box sx={{
              borderRadius: '20px', overflow: 'hidden', position: 'relative',
              background: 'linear-gradient(135deg, #1A3D5C 0%, #2E5C7F 50%, #4A8FB8 100%)',
              p: { xs: 2.5, md: 3 }, color: 'white',
              '@keyframes fadeCard': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              animation: 'fadeCard 0.5s ease 0.6s both',
            }}>
              {/* Decorative */}
              <Box sx={{
                position: 'absolute', right: -30, top: -30,
                width: 200, height: 200, borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.05)',
              }} />
              <Box sx={{
                position: 'absolute', right: 40, bottom: -50,
                width: 150, height: 150, borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.04)',
              }} />

              <Box display="flex" alignItems="center" gap={2} position="relative">
                <Box sx={{
                  width: 52, height: 52, borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LocalFireDepartmentIcon sx={{ fontSize: '1.8rem', color: '#FDE68A' }} />
                </Box>
                <Box flex={1}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', mb: 0.3 }}>
                    🌟 Chăm sóc sức khoẻ là món quà tốt nhất bạn tặng cho gia đình!
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', opacity: 0.8 }}>
                    Hãy tiếp tục duy trì thói quen tốt mỗi ngày. Bạn đang làm rất tốt!
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>

        </Grid>
      )}
    </Box>
  );
};

export default ElderlyDashboard;
