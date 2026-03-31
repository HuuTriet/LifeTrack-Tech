import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Paper, Avatar, Chip, CircularProgress,
  Alert, Tabs, Tab, Divider, Button, IconButton, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MedicationIcon from '@mui/icons-material/Medication';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelIcon from '@mui/icons-material/Cancel';
import EmailIcon from '@mui/icons-material/Email';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { medicationService, type Prescription } from '../../services/medicationService';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ElderlyProfile {
  id: string;
  userId: string;
  dateOfBirth?: string;
  gender?: string;
  weight?: number;
  height?: number;
  bloodType?: string;
  knownAllergies?: string;
  chronicConditions?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  roomNumber?: string;
  user?: { fullName?: string; name?: string; email?: string };
}

interface HealthReading {
  id: string;
  recordedAt: string;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  spo2?: number;
  temperature?: number;
  glucoseLevel?: number;
  weight?: number;
  status?: string;
  notes?: string;
}

interface MedicationLog {
  id: string;
  drugName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'PENDING' | 'TAKEN' | 'SKIPPED' | 'MISSED';
  takenAt?: string;
  notes?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const BLOOD_COLORS: Record<string, string> = {
  'A+': '#E53E3E', 'A-': '#FC8181', 'B+': '#DD6B20', 'B-': '#FBD38D',
  'AB+': '#7B2D8B', 'AB-': '#B794F4', 'O+': '#2B6CB0', 'O-': '#90CDF4',
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Nam', female: 'Nữ', other: 'Khác',
};

function getAge(dob?: string) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function getInitials(profile?: ElderlyProfile) {
  if (!profile) return '?';
  const name = profile.user?.fullName || profile.user?.name || '';
  return name.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase() || '?';
}

const STATUS_CONFIG = {
  TAKEN:    { color: '#52B788', bg: '#F0FFF4', label: 'Đã uống',   icon: <CheckCircleIcon sx={{ fontSize: '1rem' }} /> },
  PENDING:  { color: '#F4A261', bg: '#FFFBEB', label: 'Chờ uống',  icon: <AccessTimeIcon sx={{ fontSize: '1rem' }} /> },
  SKIPPED:  { color: '#E76F51', bg: '#FFF5F5', label: 'Bỏ qua',    icon: <CancelIcon sx={{ fontSize: '1rem' }} /> },
  MISSED:   { color: '#DC2626', bg: '#FEF2F2', label: 'Quên uống', icon: <WarningAmberIcon sx={{ fontSize: '1rem' }} /> },
};

const FREQ_LABELS: Record<string, string> = {
  ONCE: '1 lần/ngày', TWICE_DAILY: '2 lần/ngày', THREE_TIMES_DAILY: '3 lần/ngày',
  FOUR_TIMES_DAILY: '4 lần/ngày', WEEKLY: 'Hàng tuần', DAILY: 'Mỗi ngày', AS_NEEDED: 'Khi cần',
};

// ── Tab Panel ──────────────────────────────────────────────────────────────────

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box pt={2.5}>{children}</Box> : null;
}

// ── Main Component ─────────────────────────────────────────────────────────────

const ElderlyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [readings, setReadings] = useState<HealthReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  // Email reminder state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Excel import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [profileRes, prescRes, logsRes, healthRes] = await Promise.allSettled([
          api.get(`/elderly/${id}`),
          medicationService.getPrescriptionsByElderly(id, 1, 20),
          medicationService.getAdherenceByDate(id),
          api.get(`/health/elderly/${id}/readings`, { params: { limit: 14 } }),
        ]);

        if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
        if (prescRes.status === 'fulfilled') setPrescriptions(prescRes.value.data);
        if (logsRes.status === 'fulfilled') setLogs(logsRes.value ?? []);
        if (healthRes.status === 'fulfilled') {
          const data = healthRes.value.data;
          setReadings(Array.isArray(data) ? data : data?.data ?? []);
        }
      } catch {
        setError('Không thể tải thông tin bệnh nhân.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  // ── Email reminder handler ────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!id || !recipientEmail) return;
    setSendingEmail(true);
    try {
      await api.post('/medications/reminders/send-email', {
        elderlyId: id,
        recipientEmail,
        patientName: profile?.user?.fullName || profile?.user?.name || 'Bệnh nhân',
      });
      setSuccessMsg(`Đã gửi email nhắc thuốc tới ${recipientEmail}`);
      setEmailDialogOpen(false);
      setRecipientEmail('');
    } catch {
      setError('Không thể gửi email. Vui lòng kiểm tra địa chỉ email và thử lại.');
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Excel import handlers ─────────────────────────────────────────────────────
  const FREQ_MAP: Record<string, string> = {
    '1 lần': 'ONCE', 'once': 'ONCE',
    '2 lần': 'TWICE_DAILY', 'twice': 'TWICE_DAILY',
    '3 lần': 'THREE_TIMES_DAILY', 'three': 'THREE_TIMES_DAILY',
    '4 lần': 'FOUR_TIMES_DAILY', 'four': 'FOUR_TIMES_DAILY',
    'hàng ngày': 'DAILY', 'daily': 'DAILY',
    'hàng tuần': 'WEEKLY', 'weekly': 'WEEKLY',
    'khi cần': 'AS_NEEDED', 'as needed': 'AS_NEEDED',
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setImportRows(rows);
      setImportDialogOpen(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (!id || importRows.length === 0) return;
    setImporting(true);
    try {
      const items = importRows.map(row => ({
        drugNameRaw: String(row['Tên thuốc'] || row['drug_name'] || row['DrugName'] || ''),
        dosage: parseFloat(String(row['Liều dùng'] || row['dosage'] || '')) || undefined,
        dosageUnit: String(row['Đơn vị'] || row['unit'] || 'mg') || 'mg',
        frequency: FREQ_MAP[String(row['Tần suất'] || row['frequency'] || '').toLowerCase()] || 'DAILY',
        scheduledTimes: String(row['Giờ uống'] || row['time'] || '08:00').split(',').map((t: string) => t.trim()).filter(Boolean),
        mealRelation: String(row['Bữa ăn'] || row['meal'] || 'INDEPENDENT').toUpperCase() as any,
        instructions: String(row['Hướng dẫn'] || row['instructions'] || '') || undefined,
        isGenericReminder: false,
        unknownDosage: !row['Liều dùng'] && !row['dosage'],
      })).filter(item => item.drugNameRaw);

      await medicationService.createPrescription({
        elderlyId: id,
        startDate: new Date().toISOString().split('T')[0],
        source: 'MANUAL',
        items: items as any,
      });

      setSuccessMsg(`Đã import ${items.length} thuốc thành công!`);
      setImportDialogOpen(false);
      setImportRows([]);
      // Refresh prescriptions
      const res = await medicationService.getPrescriptionsByElderly(id, 1, 20);
      setPrescriptions(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Import thất bại. Kiểm tra lại file Excel.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'Tên thuốc': 'Metformin',
        'Liều dùng': 500,
        'Đơn vị': 'mg',
        'Tần suất': '2 lần',
        'Giờ uống': '08:00, 20:00',
        'Bữa ăn': 'AFTER',
        'Hướng dẫn': 'Uống sau bữa ăn với nước lọc',
      },
      {
        'Tên thuốc': 'Amlodipine',
        'Liều dùng': 5,
        'Đơn vị': 'mg',
        'Tần suất': '1 lần',
        'Giờ uống': '07:00',
        'Bữa ăn': 'INDEPENDENT',
        'Hướng dẫn': '',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn thuốc');
    XLSX.writeFile(wb, 'mau_don_thuoc.xlsx');
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const chartData = [...readings].reverse().map(r => ({
    date: format(new Date(r.recordedAt), 'dd/MM'),
    'Tim': r.heartRate,
    'HA tâm thu': r.bloodPressureSystolic,
    'HA tâm trương': r.bloodPressureDiastolic,
    'SpO2': r.spo2,
    'Nhiệt độ': r.temperature,
  }));

  const latestReading = readings[0];

  const takenCount = logs.filter(l => l.status === 'TAKEN').length;
  const totalLogs = logs.length;
  const adherenceRate = totalLogs > 0 ? Math.round((takenCount / totalLogs) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress size={56} sx={{ color: '#2E5C7F' }} />
      </Box>
    );
  }

  const name = profile?.user?.fullName || profile?.user?.name || 'Không rõ';
  const age = getAge(profile?.dateOfBirth);

  return (
    <Box sx={{
      '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: 'fadeIn 0.4s ease',
    }}>
      {/* ── Back button ───────────────────────────────────────────────────────── */}
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <IconButton onClick={() => navigate('/caregiver/elderly')}
          sx={{ bgcolor: '#F1F5F9', borderRadius: '10px', '&:hover': { bgcolor: '#E2E8F0' } }}>
          <ArrowBackIcon sx={{ color: '#2E5C7F' }} />
        </IconButton>
        <Typography sx={{ color: '#7A8B99', fontSize: '0.9rem' }}>
          Hồ sơ bệnh nhân / <strong style={{ color: '#2E5C7F' }}>{name}</strong>
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      {/* ── Action Toolbar ─────────────────────────────────────────────────────── */}
      <Box display="flex" gap={1.5} mb={2.5} flexWrap="wrap">
        <Button
          variant="contained" startIcon={<EmailIcon />}
          onClick={() => {
            setRecipientEmail(profile?.user?.email || '');
            setEmailDialogOpen(true);
          }}
          sx={{
            borderRadius: '12px', fontWeight: 700, fontSize: '0.88rem',
            background: 'linear-gradient(135deg, #2E5C7F, #4A8FB8)',
            boxShadow: '0 4px 14px rgba(46,92,127,0.3)',
            px: 2.5, py: 1,
          }}
        >
          Gửi nhắc thuốc qua email
        </Button>
        <Button
          variant="outlined" startIcon={<UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ borderRadius: '12px', fontWeight: 700, fontSize: '0.88rem', borderColor: '#52B788', color: '#52B788', '&:hover': { bgcolor: '#F0FFF4', borderColor: '#52B788' }, px: 2.5, py: 1 }}
        >
          Import từ Excel
        </Button>
        <Button
          variant="text" startIcon={<DownloadIcon />}
          onClick={handleDownloadTemplate}
          sx={{ borderRadius: '12px', fontWeight: 600, fontSize: '0.85rem', color: '#64748B', px: 2, py: 1 }}
        >
          Tải file mẫu
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
      </Box>

      {/* ── Profile Header Card ────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        borderRadius: '20px', border: '1.5px solid #E2E8F0', overflow: 'hidden', mb: 3,
      }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
          p: 3, display: 'flex', alignItems: 'flex-start', gap: 2.5, flexWrap: 'wrap',
        }}>
          <Avatar sx={{ width: 72, height: 72, bgcolor: 'rgba(255,255,255,0.25)', fontWeight: 700, fontSize: '1.5rem' }}>
            {getInitials(profile ?? undefined)}
          </Avatar>
          <Box flex={1}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color: '#fff' }}>{name}</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.88rem', mb: 1 }}>
              {profile?.user?.email}
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {age !== null && (
                <Chip label={`${age} tuổi`} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }} />
              )}
              {profile?.gender && (
                <Chip label={GENDER_LABELS[profile.gender] || profile.gender} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
              )}
              {profile?.bloodType && profile.bloodType !== 'UNKNOWN' && (
                <Chip label={`Nhóm máu ${profile.bloodType}`} size="small"
                  sx={{ bgcolor: `${BLOOD_COLORS[profile.bloodType] || '#E53E3E'}`, color: '#fff', fontWeight: 700 }} />
              )}
              {profile?.roomNumber && (
                <Chip label={`Phòng ${profile.roomNumber}`} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
              )}
            </Box>
          </Box>

          {/* Quick stats */}
          <Box display="flex" gap={2} flexWrap="wrap">
            {[
              { label: 'Tuân thủ', value: `${adherenceRate}%`, color: adherenceRate >= 80 ? '#52B788' : '#F4A261' },
              { label: 'Đơn thuốc', value: prescriptions.length },
              { label: 'Chỉ số hôm nay', value: readings.length > 0 ? '✓' : '–' },
            ].map(s => (
              <Box key={s.label} sx={{
                bgcolor: 'rgba(255,255,255,0.15)', borderRadius: '14px',
                px: 2.5, py: 1.5, textAlign: 'center', minWidth: 80,
              }}>
                <Typography sx={{ color: s.color || '#fff', fontWeight: 800, fontSize: '1.3rem' }}>
                  {s.value}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem' }}>
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Medical info row */}
        <Box sx={{ p: 2.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {profile?.chronicConditions && (
            <Box flex={1} minWidth={200} p={1.5} sx={{ bgcolor: '#FFF7ED', borderRadius: '12px', border: '1px solid #FED7AA' }}>
              <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
                <LocalHospitalIcon sx={{ fontSize: '0.9rem', color: '#D97706' }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706' }}>BỆNH MÃN TÍNH</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.85rem', color: '#92400E' }}>{profile.chronicConditions}</Typography>
            </Box>
          )}
          {profile?.knownAllergies && (
            <Box flex={1} minWidth={200} p={1.5} sx={{ bgcolor: '#FFF5F5', borderRadius: '12px', border: '1px solid #FEE2E2' }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#DC2626', mb: 0.3 }}>⚠️ DỊ ỨNG</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#B91C1C' }}>{profile.knownAllergies}</Typography>
            </Box>
          )}
          {profile?.emergencyContactName && (
            <Box flex={1} minWidth={200} p={1.5} sx={{ bgcolor: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
              <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
                <ContactPhoneIcon sx={{ fontSize: '0.9rem', color: '#2E5C7F' }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#3B82F6' }}>LIÊN HỆ KHẨN CẤP</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E40AF' }}>
                {profile.emergencyContactName}
                {profile.emergencyContactPhone && ` · ${profile.emergencyContactPhone}`}
              </Typography>
            </Box>
          )}
          {profile?.weight && profile?.height && (
            <Box p={1.5} sx={{ bgcolor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#64748B', mb: 0.3 }}>THỂ TRẠNG</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1E293B' }}>
                {profile.weight} kg · {profile.height} cm
              </Typography>
              {profile.weight && profile.height && (
                <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>
                  BMI: {(profile.weight / ((profile.height / 100) ** 2)).toFixed(1)}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ borderRadius: '20px', border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            px: 2, borderBottom: '1px solid #E2E8F0',
            '& .MuiTab-root': { fontWeight: 600, fontSize: '0.9rem', textTransform: 'none', minHeight: 52 },
            '& .Mui-selected': { color: '#2E5C7F' },
            '& .MuiTabs-indicator': { bgcolor: '#2E5C7F', height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          <Tab icon={<MedicationIcon sx={{ fontSize: '1.1rem' }} />} iconPosition="start" label="Đơn thuốc" />
          <Tab icon={<MonitorHeartIcon sx={{ fontSize: '1.1rem' }} />} iconPosition="start" label="Chỉ số sức khoẻ" />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {/* ── Đơn thuốc Tab ────────────────────────────────────────────────── */}
          <TabPanel value={tab} index={0}>
            {/* Adherence summary */}
            <Grid container spacing={2} mb={3}>
              {[
                { label: 'Tổng lần uống hôm nay', value: totalLogs, color: '#2E5C7F', bg: '#EBF4FB' },
                { label: 'Đã uống', value: takenCount, color: '#52B788', bg: '#F0FFF4' },
                { label: 'Tuân thủ', value: `${adherenceRate}%`, color: adherenceRate >= 80 ? '#52B788' : '#E76F51', bg: '#FAFAFA' },
                { label: 'Đơn thuốc đang dùng', value: prescriptions.filter(p => p.status === 'ACTIVE').length, color: '#F4A261', bg: '#FFFBEB' },
              ].map(s => (
                <Grid item xs={6} md={3} key={s.label}>
                  <Paper elevation={0} sx={{ borderRadius: '16px', p: 2, bgcolor: s.bg, textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color: s.color }}>{s.value}</Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: '#64748B', mt: 0.5 }}>{s.label}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Today's medication logs */}
            {logs.length > 0 && (
              <Box mb={3}>
                <Typography sx={{ fontWeight: 700, color: '#1E293B', mb: 1.5, fontSize: '0.95rem' }}>
                  Nhật ký thuốc hôm nay
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {logs.map((log, idx) => {
                    const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.PENDING;
                    return (
                      <Box key={log.id} sx={{
                        display: 'flex', alignItems: 'center', gap: 2,
                        p: 1.75, borderRadius: '14px', bgcolor: cfg.bg,
                        border: `1px solid ${cfg.color}30`,
                        '@keyframes logIn': { from: { opacity: 0, x: -8 }, to: { opacity: 1, x: 0 } },
                        animation: `logIn 0.35s ease ${idx * 0.06}s both`,
                      }}>
                        <Box sx={{ color: cfg.color }}>{cfg.icon}</Box>
                        <Box flex={1}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: '#1E293B' }}>
                            {log.drugName}
                          </Typography>
                          <Typography sx={{ fontSize: '0.78rem', color: '#64748B' }}>
                            {log.scheduledTime} · {log.scheduledDate}
                          </Typography>
                        </Box>
                        <Chip
                          label={cfg.label} size="small"
                          sx={{ bgcolor: `${cfg.color}20`, color: cfg.color, fontWeight: 700, fontSize: '0.75rem' }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Prescriptions list */}
            <Typography sx={{ fontWeight: 700, color: '#1E293B', mb: 1.5, fontSize: '0.95rem' }}>
              Danh sách đơn thuốc ({prescriptions.length})
            </Typography>
            {prescriptions.length === 0 ? (
              <Box textAlign="center" py={5}>
                <MedicationIcon sx={{ fontSize: 48, color: '#CBD5E1', mb: 1 }} />
                <Typography sx={{ color: '#94A3B8' }}>Chưa có đơn thuốc nào.</Typography>
                <Button variant="contained" size="small" sx={{ mt: 2, borderRadius: '10px', bgcolor: '#2E5C7F' }}
                  onClick={() => navigate('/caregiver/medications/add')}>
                  Thêm đơn thuốc
                </Button>
              </Box>
            ) : (
              <Box display="flex" flexDirection="column" gap={1.5}>
                {prescriptions.map((p, idx) => (
                  <Paper key={p.id} elevation={0} sx={{
                    borderRadius: '16px', border: '1.5px solid #E2E8F0', overflow: 'hidden',
                    '@keyframes prescIn': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                    animation: `prescIn 0.4s ease ${idx * 0.07}s both`,
                    '&:hover': { borderColor: '#93C5FD', boxShadow: '0 4px 16px rgba(46,92,127,0.08)' },
                    transition: 'all 0.2s',
                  }}>
                    {/* Prescription header */}
                    <Box sx={{
                      px: 2.5, py: 1.75, bgcolor: p.status === 'ACTIVE' ? '#EBF4FB' : '#F8FAFC',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#2E5C7F' }}>
                          {p.prescriptionNumber || `Đơn #${idx + 1}`}
                          {p.diagnosis && ` · ${p.diagnosis}`}
                        </Typography>
                        {p.doctorName && (
                          <Typography sx={{ fontSize: '0.78rem', color: '#64748B' }}>
                            BS. {p.doctorName} {p.hospitalName ? `· ${p.hospitalName}` : ''}
                          </Typography>
                        )}
                      </Box>
                      <Box display="flex" gap={1} alignItems="center">
                        <Chip
                          label={p.status === 'ACTIVE' ? 'Đang dùng' : p.status === 'COMPLETED' ? 'Hoàn thành' : 'Đã huỷ'}
                          size="small"
                          sx={{
                            bgcolor: p.status === 'ACTIVE' ? '#DCFCE7' : '#F1F5F9',
                            color: p.status === 'ACTIVE' ? '#16A34A' : '#64748B',
                            fontWeight: 700, fontSize: '0.75rem',
                          }}
                        />
                        <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                          {p.startDate}{p.endDate ? ` → ${p.endDate}` : ''}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Items */}
                    <Box sx={{ px: 2.5, py: 1.5 }}>
                      {p.items.map(item => (
                        <Box key={item.id} sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, py: 1,
                          borderBottom: '1px solid #F1F5F9', '&:last-child': { borderBottom: 'none' },
                        }}>
                          <MedicationIcon sx={{ fontSize: '1rem', color: '#4A8FB8' }} />
                          <Box flex={1}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.87rem', color: '#1E293B' }}>
                              {item.drug?.genericName || item.drugNameRaw || 'Thuốc không rõ'}
                              {item.dosage && ` · ${item.dosage}${item.dosageUnit || 'mg'}`}
                            </Typography>
                            <Typography sx={{ fontSize: '0.77rem', color: '#64748B' }}>
                              {FREQ_LABELS[item.frequency || ''] || item.frequency}
                              {item.scheduledTimes?.length ? ` · ${item.scheduledTimes.join(', ')}` : ''}
                              {item.mealRelation === 'BEFORE' ? ' · Trước ăn' : item.mealRelation === 'AFTER' ? ' · Sau ăn' : item.mealRelation === 'WITH' ? ' · Trong bữa ăn' : ''}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </TabPanel>

          {/* ── Chỉ số sức khoẻ Tab ──────────────────────────────────────────── */}
          <TabPanel value={tab} index={1}>
            {/* Latest reading summary */}
            {latestReading && (
              <Grid container spacing={2} mb={3}>
                {[
                  { label: 'Nhịp tim', value: latestReading.heartRate ? `${latestReading.heartRate} bpm` : '–', icon: <FavoriteIcon />, color: '#E76F51', bg: '#FFF5F5' },
                  { label: 'Huyết áp', value: latestReading.bloodPressureSystolic ? `${latestReading.bloodPressureSystolic}/${latestReading.bloodPressureDiastolic} mmHg` : '–', icon: <MonitorHeartIcon />, color: '#2E5C7F', bg: '#EBF4FB' },
                  { label: 'SpO2', value: latestReading.spo2 ? `${latestReading.spo2}%` : '–', icon: <CheckCircleIcon />, color: '#52B788', bg: '#F0FFF4' },
                  { label: 'Nhiệt độ', value: latestReading.temperature ? `${latestReading.temperature}°C` : '–', icon: <WarningAmberIcon />, color: '#F4A261', bg: '#FFFBEB' },
                ].map(m => (
                  <Grid item xs={6} md={3} key={m.label}>
                    <Paper elevation={0} sx={{ borderRadius: '16px', p: 2, bgcolor: m.bg, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ color: m.color }}>{m.icon}</Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: m.color }}>{m.value}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>{m.label}</Typography>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Chart */}
            {chartData.length > 0 ? (
              <Box mb={3}>
                <Typography sx={{ fontWeight: 700, color: '#1E293B', mb: 2, fontSize: '0.95rem' }}>
                  Xu hướng 14 ngày gần nhất
                </Typography>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradHR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E76F51" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#E76F51" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradSys" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2E5C7F" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2E5C7F" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <ChartTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }} />
                      <Legend wrapperStyle={{ fontSize: '0.82rem' }} />
                      <Area type="monotone" dataKey="Tim" stroke="#E76F51" fill="url(#gradHR)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="HA tâm thu" stroke="#2E5C7F" fill="url(#gradSys)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="SpO2" stroke="#52B788" fill="none" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            ) : (
              <Box textAlign="center" py={5}>
                <MonitorHeartIcon sx={{ fontSize: 48, color: '#CBD5E1', mb: 1 }} />
                <Typography sx={{ color: '#94A3B8' }}>Chưa có chỉ số sức khoẻ nào được ghi nhận.</Typography>
              </Box>
            )}

            {/* Readings table */}
            {readings.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 700, color: '#1E293B', mb: 1.5, fontSize: '0.95rem' }}>
                  Lịch sử đo gần đây
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 520 }}>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, color: '#64748B', fontSize: '0.78rem', bgcolor: '#F8FAFC', borderBottom: '2px solid #E2E8F0' } }}>
                        <TableCell>Ngày giờ</TableCell>
                        <TableCell align="center">Nhịp tim</TableCell>
                        <TableCell align="center">Huyết áp</TableCell>
                        <TableCell align="center">SpO2</TableCell>
                        <TableCell align="center">Nhiệt độ</TableCell>
                        <TableCell align="center">Trạng thái</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {readings.slice(0, 10).map((r, idx) => (
                        <TableRow key={r.id} sx={{
                          '&:hover': { bgcolor: '#F8FAFC' },
                          '@keyframes rowIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                          animation: `rowIn 0.3s ease ${idx * 0.05}s both`,
                        }}>
                          <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>
                            {format(new Date(r.recordedAt), 'HH:mm dd/MM/yyyy')}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: '#E76F51', fontSize: '0.82rem' }}>
                            {r.heartRate ? `${r.heartRate} bpm` : '–'}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: '#2E5C7F', fontSize: '0.82rem' }}>
                            {r.bloodPressureSystolic ? `${r.bloodPressureSystolic}/${r.bloodPressureDiastolic}` : '–'}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, color: '#52B788', fontSize: '0.82rem' }}>
                            {r.spo2 ? `${r.spo2}%` : '–'}
                          </TableCell>
                          <TableCell align="center" sx={{ fontSize: '0.82rem', color: '#374151' }}>
                            {r.temperature ? `${r.temperature}°C` : '–'}
                          </TableCell>
                          <TableCell align="center">
                            {r.status && (
                              <Chip label={r.status} size="small" sx={{
                                fontSize: '0.72rem', fontWeight: 700,
                                bgcolor: r.status === 'NORMAL' ? '#DCFCE7' : r.status === 'WARNING' ? '#FEF9C3' : '#FEE2E2',
                                color: r.status === 'NORMAL' ? '#16A34A' : r.status === 'WARNING' ? '#92400E' : '#DC2626',
                              }} />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </>
            )}
          </TabPanel>
        </Box>
      </Paper>
      {/* ── Email Reminder Dialog ──────────────────────────────────────────────── */}
      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#2E5C7F', pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <EmailIcon sx={{ color: '#4A8FB8' }} />
            Gửi nhắc uống thuốc qua email
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#64748B', fontSize: '0.88rem', mb: 2 }}>
            Email sẽ gửi lịch uống thuốc hôm nay của <strong>{profile?.user?.fullName || profile?.user?.name}</strong>,
            kèm nút <strong>Đã uống</strong> và <strong>Nhắc lại</strong> để bệnh nhân phản hồi trực tiếp qua email.
          </Typography>
          <TextField
            fullWidth label="Địa chỉ email người nhận"
            type="email"
            value={recipientEmail}
            onChange={e => setRecipientEmail(e.target.value)}
            placeholder="example@gmail.com"
            InputProps={{ sx: { borderRadius: '12px' } }}
            helperText="Có thể gửi tới email bệnh nhân hoặc người thân"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setEmailDialogOpen(false)} sx={{ borderRadius: '10px', color: '#64748B' }}>Huỷ</Button>
          <Button
            variant="contained" onClick={handleSendEmail}
            disabled={sendingEmail || !recipientEmail}
            startIcon={sendingEmail ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}
            sx={{ borderRadius: '10px', fontWeight: 700, bgcolor: '#2E5C7F', px: 3 }}
          >
            {sendingEmail ? 'Đang gửi...' : 'Gửi email'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Excel Import Preview Dialog ────────────────────────────────────────── */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#2E5C7F', pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <UploadFileIcon sx={{ color: '#52B788' }} />
            Xem trước dữ liệu import ({importRows.length} thuốc)
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#64748B', fontSize: '0.85rem', mb: 2 }}>
            Kiểm tra dữ liệu trước khi import. Các dòng thiếu "Tên thuốc" sẽ bị bỏ qua.
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F0FFF4', color: '#15803D', fontSize: '0.78rem' } }}>
                  <TableCell>Tên thuốc</TableCell>
                  <TableCell>Liều dùng</TableCell>
                  <TableCell>Đơn vị</TableCell>
                  <TableCell>Tần suất</TableCell>
                  <TableCell>Giờ uống</TableCell>
                  <TableCell>Bữa ăn</TableCell>
                  <TableCell>Hướng dẫn</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importRows.map((row, i) => (
                  <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem', color: row['Tên thuốc'] ? '#1E293B' : '#EF4444' }}>
                      {row['Tên thuốc'] || row['drug_name'] || '⚠️ Thiếu'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.82rem' }}>{row['Liều dùng'] || row['dosage'] || '–'}</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem' }}>{row['Đơn vị'] || row['unit'] || 'mg'}</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem' }}>{row['Tần suất'] || row['frequency'] || '–'}</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem' }}>{row['Giờ uống'] || row['time'] || '–'}</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem' }}>{row['Bữa ăn'] || row['meal'] || '–'}</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', color: '#64748B' }}>{row['Hướng dẫn'] || row['instructions'] || '–'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setImportDialogOpen(false)} sx={{ borderRadius: '10px', color: '#64748B' }}>Huỷ</Button>
          <Button
            variant="contained" onClick={handleImportSubmit}
            disabled={importing || importRows.every(r => !r['Tên thuốc'] && !r['drug_name'])}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
            sx={{ borderRadius: '10px', fontWeight: 700, bgcolor: '#52B788', px: 3 }}
          >
            {importing ? 'Đang import...' : `Import ${importRows.filter(r => r['Tên thuốc'] || r['drug_name']).length} thuốc`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ElderlyDetailPage;
