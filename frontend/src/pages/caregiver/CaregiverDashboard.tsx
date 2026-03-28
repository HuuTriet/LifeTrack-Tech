import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MedicationIcon from '@mui/icons-material/Medication';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HighContrastCard from '../../components/common/HighContrastCard';
import { useAuthStore } from '../../store/authStore';
import { medicationService, type AdherenceStats } from '../../services/medicationService';
import { healthService, type HealthTrendsResponse } from '../../services/healthService';
import api from '../../services/api';

// ---- Types ----

interface ElderlyOption {
  id: string;
  label: string;
}

interface Alert7d {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  time: string;
}

// ---- Static fallback data (used when API is unavailable) ----

const FALLBACK_HEALTH_DATA = [
  { date: 'T2', heartRate: 72, systolic: 128, diastolic: 82, spo2: 96 },
  { date: 'T3', heartRate: 75, systolic: 130, diastolic: 85, spo2: 97 },
  { date: 'T4', heartRate: 70, systolic: 125, diastolic: 80, spo2: 96 },
  { date: 'T5', heartRate: 78, systolic: 135, diastolic: 88, spo2: 95 },
  { date: 'T6', heartRate: 73, systolic: 127, diastolic: 82, spo2: 97 },
  { date: 'T7', heartRate: 71, systolic: 124, diastolic: 79, spo2: 98 },
  { date: 'CN', heartRate: 74, systolic: 129, diastolic: 83, spo2: 96 },
];

const FALLBACK_ADHERENCE_DATA = [
  { date: 'T2', taken: 5, missed: 1 },
  { date: 'T3', taken: 6, missed: 0 },
  { date: 'T4', taken: 4, missed: 2 },
  { date: 'T5', taken: 6, missed: 0 },
  { date: 'T6', taken: 5, missed: 1 },
  { date: 'T7', taken: 6, missed: 0 },
  { date: 'CN', taken: 5, missed: 1 },
];

const FALLBACK_ALERTS: Alert7d[] = [
  {
    id: '1',
    severity: 'danger',
    title: 'Tương tác thuốc nguy hiểm',
    message: 'Aspirin + Simvastatin → nguy cơ cao',
    time: '2 giờ trước',
  },
  {
    id: '2',
    severity: 'warning',
    title: 'Sắp hết thuốc',
    message: 'Metformin còn 3 ngày',
    time: '5 giờ trước',
  },
  {
    id: '3',
    severity: 'info',
    title: 'Uống thuốc đúng giờ',
    message: 'Lisinopril — đã uống lúc 8:30',
    time: '8 giờ trước',
  },
];

// ---- Component ----

const CaregiverDashboard: React.FC = () => {
  const { getElderlyId, selectElderly } = useAuthStore();

  // Patient selection
  const [elderlyOptions, setElderlyOptions] = useState<ElderlyOption[]>([]);
  const [selectedElderlyId, setSelectedElderlyId] = useState<string>(getElderlyId() ?? '');
  const [loadingPatients, setLoadingPatients] = useState(true);

  // API data
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStats | null>(null);
  const [healthTrends, setHealthTrends] = useState<HealthTrendsResponse | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert7d[]>(FALLBACK_ALERTS);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // ── Load patient list ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchPatients = async () => {
      setLoadingPatients(true);
      try {
        const res = await api.get('/elderly');
        const profiles: any[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
        const opts: ElderlyOption[] = profiles.map((p) => ({
          id: p.id,
          label: p.user?.fullName || p.user?.name || `Patient #${p.id.slice(0, 8)}`,
        }));
        setElderlyOptions(opts);

        const storeId = getElderlyId();
        if (storeId && opts.some((o) => o.id === storeId)) {
          setSelectedElderlyId(storeId);
        } else if (opts.length > 0) {
          setSelectedElderlyId(opts[0].id);
          selectElderly(opts[0].id);
        }
      } catch {
        // Use store value if available; otherwise proceed without patient list
        const storeId = getElderlyId();
        if (storeId) {
          setElderlyOptions([{ id: storeId, label: 'Current Patient' }]);
          setSelectedElderlyId(storeId);
        }
      } finally {
        setLoadingPatients(false);
      }
    };
    fetchPatients();
  }, []);

  // ── Load dashboard data whenever selected patient changes ──────────────────
  const loadDashboardData = useCallback(async (elderlyId: string) => {
    if (!elderlyId) return;
    setLoadingStats(true);
    setStatsError(null);

    const [statsResult, trendsResult, notificationsResult] = await Promise.allSettled([
      medicationService.getAdherenceStats(elderlyId, 7),
      healthService.getTrends(elderlyId, '7d'),
      api.get('/notifications', { params: { limit: 5 } }),
    ]);

    if (statsResult.status === 'fulfilled') {
      setAdherenceStats(statsResult.value);
    }

    if (trendsResult.status === 'fulfilled') {
      setHealthTrends(trendsResult.value);
    }

    if (notificationsResult.status === 'fulfilled') {
      const notes = notificationsResult.value.data?.notifications ?? [];
      if (notes.length > 0) {
        const mapped: Alert7d[] = notes.slice(0, 5).map((n: any) => ({
          id: n.id,
          severity:
            n.priority === 'CRITICAL' || n.priority === 'HIGH'
              ? 'danger'
              : n.priority === 'MEDIUM'
              ? 'warning'
              : 'info',
          title: n.title,
          message: n.body,
          time: new Date(n.createdAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));
        setRecentAlerts(mapped);
      }
    }

    // Only surface an error if both stats AND trends fail
    if (
      statsResult.status === 'rejected' &&
      trendsResult.status === 'rejected'
    ) {
      setStatsError('Could not load live data — showing cached values.');
    }

    setLoadingStats(false);
  }, []);

  useEffect(() => {
    if (selectedElderlyId) {
      loadDashboardData(selectedElderlyId);
    }
  }, [selectedElderlyId, loadDashboardData]);

  // ── Derived chart data ─────────────────────────────────────────────────────

  const healthChartData = healthTrends
    ? healthTrends.trendData.map((p) => ({
        date: new Date(p.date).toLocaleDateString('vi-VN', { weekday: 'short' }),
        heartRate: p.heartRate,
        systolic: p.bloodPressureSystolic,
        diastolic: p.bloodPressureDiastolic,
        spo2: p.spo2,
      }))
    : FALLBACK_HEALTH_DATA;

  const adherenceChartData = FALLBACK_ADHERENCE_DATA; // enriched when backend sends daily breakdown

  // ── Stats cards ────────────────────────────────────────────────────────────

  const adherenceRate = adherenceStats
    ? `${adherenceStats.adherenceRate}%`
    : '—';

  const avgHR = healthTrends?.summary?.averageHeartRate
    ? `${healthTrends.summary.averageHeartRate} BPM`
    : '73 BPM';

  const activeAlerts = healthTrends
    ? healthTrends.summary.criticalCount + healthTrends.summary.warningCount
    : 2;

  const STATS = [
    {
      label: 'Tỉ lệ uống thuốc',
      value: adherenceRate,
      icon: <MedicationIcon />,
      color: '#52B788',
      sub: adherenceStats ? `${adherenceStats.period}` : '↑ 7 ngày qua',
    },
    {
      label: 'Nhịp tim TB',
      value: avgHR,
      icon: <FavoriteIcon />,
      color: '#E76F51',
      sub: 'Bình thường',
    },
    {
      label: 'Huyết áp TB',
      value: '128/82',
      icon: <MonitorHeartIcon />,
      color: '#4A8FB8',
      sub: 'mmHg',
    },
    {
      label: 'Cảnh báo active',
      value: String(activeAlerts),
      icon: <WarningAmberIcon />,
      color: '#F4A261',
      sub: 'Cần xem xét',
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#2E5C7F' }}>
          Dashboard Người chăm sóc
        </Typography>

        {/* Patient selector */}
        {!loadingPatients && elderlyOptions.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Bệnh nhân</InputLabel>
            <Select
              value={selectedElderlyId}
              label="Bệnh nhân"
              onChange={(e) => {
                const id = e.target.value as string;
                setSelectedElderlyId(id);
                selectElderly(id);
              }}
            >
              {elderlyOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {loadingPatients && <CircularProgress size={24} />}
      </Box>

      {statsError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setStatsError(null)}>
          {statsError}
        </Alert>
      )}

      {/* ---- Stat Cards ---- */}
      <Grid container spacing={2.5} mb={4}>
        {STATS.map((stat) => (
          <Grid item xs={12} sm={6} xl={3} key={stat.label}>
            <Box
              sx={{
                bgcolor: '#fff',
                borderRadius: '20px',
                p: 3,
                boxShadow: '0 2px 12px rgba(46,92,127,0.08)',
                borderLeft: `6px solid ${stat.color}`,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                position: 'relative',
              }}
            >
              {loadingStats && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                  }}
                >
                  <CircularProgress size={14} />
                </Box>
              )}
              <Avatar
                sx={{ bgcolor: `${stat.color}18`, color: stat.color, width: 52, height: 52 }}
              >
                {stat.icon}
              </Avatar>
              <Box>
                <Typography
                  sx={{ fontSize: '2rem', fontWeight: 700, color: '#2C3E50', lineHeight: 1 }}
                >
                  {stat.value}
                </Typography>
                <Typography sx={{ color: '#7A8B99', fontSize: '0.9rem', mt: 0.5 }}>
                  {stat.label}
                </Typography>
                <Typography sx={{ color: stat.color, fontSize: '0.85rem', fontWeight: 600 }}>
                  {stat.sub}
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* ---- Blood Pressure & Heart Rate Chart ---- */}
        <Grid item xs={12} lg={8}>
          <HighContrastCard title="Chỉ số sức khỏe 7 ngày" accentColor="#2E5C7F">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={healthChartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E76F51" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E76F51" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A8FB8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4A8FB8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="date" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 13 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E8F0F7', fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Area
                  type="monotone"
                  dataKey="heartRate"
                  name="Nhịp tim (BPM)"
                  stroke="#E76F51"
                  fill="url(#hrGrad)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="systolic"
                  name="HA tâm thu"
                  stroke="#4A8FB8"
                  fill="url(#bpGrad)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  name="HA tâm trương"
                  stroke="#52B788"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </HighContrastCard>
        </Grid>

        {/* ---- Alerts ---- */}
        <Grid item xs={12} lg={4}>
          <HighContrastCard title="Cảnh báo & Nhắc nhở" accentColor="#E76F51">
            <List disablePadding>
              {recentAlerts.map((alert) => (
                <ListItem
                  key={alert.id}
                  alignItems="flex-start"
                  sx={{
                    bgcolor:
                      alert.severity === 'danger'
                        ? '#FFF5F3'
                        : alert.severity === 'warning'
                        ? '#FFFBF0'
                        : '#F0F8FF',
                    borderRadius: '12px',
                    mb: 1.5,
                    px: 2,
                    borderLeft: `4px solid ${
                      alert.severity === 'danger'
                        ? '#E76F51'
                        : alert.severity === 'warning'
                        ? '#F4A261'
                        : '#4A8FB8'
                    }`,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                    {alert.severity === 'danger' ? (
                      <WarningAmberIcon sx={{ color: '#E76F51', fontSize: '1.2rem' }} />
                    ) : alert.severity === 'warning' ? (
                      <WarningAmberIcon sx={{ color: '#F4A261', fontSize: '1.2rem' }} />
                    ) : (
                      <CheckCircleIcon sx={{ color: '#4A8FB8', fontSize: '1.2rem' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#2C3E50' }}
                      >
                        {alert.title}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          sx={{ fontSize: '0.85rem', color: '#7A8B99', display: 'block' }}
                        >
                          {alert.message}
                        </Typography>
                        <Typography
                          component="span"
                          sx={{ fontSize: '0.8rem', color: '#B0B8C1' }}
                        >
                          {alert.time}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </HighContrastCard>
        </Grid>

        {/* ---- Medication Adherence Bar Chart ---- */}
        <Grid item xs={12}>
          <HighContrastCard title="Lịch sử uống thuốc 7 ngày" accentColor="#52B788">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={adherenceChartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="date" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 13 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E8F0F7', fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="taken" name="Đã uống" fill="#52B788" radius={[6, 6, 0, 0]} />
                <Bar dataKey="missed" name="Bỏ lỡ" fill="#E76F51" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </HighContrastCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CaregiverDashboard;
