import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Tooltip, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import VideocamIcon from '@mui/icons-material/Videocam';
import HomeIcon from '@mui/icons-material/Home';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { appointmentService, Appointment, CreateAppointmentPayload } from '../../services/appointmentService';
import { useAuthStore } from '../../store/authStore';
import { useAiChat } from '../../contexts/AiChatContext';

const SPECIALTY_QUICK_PICKS = [
  'Tim mạch', 'Nội tiết', 'Nội khoa', 'Thần kinh',
  'Cơ xương khớp', 'Mắt', 'Tai mũi họng', 'Da liễu',
];

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CLINIC: { label: 'Phòng khám', icon: <LocalHospitalIcon />, color: '#2E5C7F' },
  TELEMEDICINE: { label: 'Khám từ xa', icon: <VideocamIcon />, color: '#52B788' },
  HOME_VISIT: { label: 'Khám tại nhà', icon: <HomeIcon />, color: '#E88D5D' },
};

const STATUS_LABELS: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  SCHEDULED: { label: 'Đã đặt', color: 'primary' },
  COMPLETED: { label: 'Hoàn thành', color: 'success' },
  CANCELLED: { label: 'Đã huỷ', color: 'error' },
  NO_SHOW: { label: 'Vắng mặt', color: 'warning' },
};

const INITIAL_FORM: CreateAppointmentPayload = {
  elderlyId: '',
  doctorName: '',
  specialty: '',
  hospitalName: '',
  hospitalAddress: '',
  appointmentDate: '',
  durationMinutes: 30,
  appointmentType: 'CLINIC',
  reason: '',
  notes: '',
};

const AppointmentPage: React.FC = () => {
  const { openChat } = useAiChat();
  const getElderlyId = useAuthStore((s) => s.getElderlyId);
  const elderlyId = getElderlyId() ?? '';

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState<CreateAppointmentPayload>({ ...INITIAL_FORM, elderlyId });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'all'>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!elderlyId) return;
    setLoading(true);
    setError('');
    try {
      if (tab === 'upcoming') {
        const data = await appointmentService.getUpcoming(elderlyId, 30);
        setAppointments(data);
      } else {
        const res = await appointmentService.getByElderly(elderlyId, { limit: 50 });
        setAppointments(res.data);
      }
    } catch {
      setError('Không thể tải danh sách lịch hẹn.');
    } finally {
      setLoading(false);
    }
  }, [elderlyId, tab]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.doctorName || !form.appointmentDate) return;
    setSaving(true);
    try {
      await appointmentService.create({ ...form, elderlyId });
      setOpenAdd(false);
      setForm({ ...INITIAL_FORM, elderlyId });
      load();
    } catch {
      setError('Không thể tạo lịch hẹn. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await appointmentService.cancel(id);
      setCancelTarget(null);
      load();
    } catch {
      setError('Không thể huỷ lịch hẹn.');
      setCancelTarget(null);
    }
  };

  const grouped = {
    upcoming: appointments.filter(a => a.status === 'SCHEDULED'),
    past: appointments.filter(a => a.status !== 'SCHEDULED'),
  };

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
          src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&q=80"
          alt="Hospital appointment"
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(46,92,127,0.88) 0%, rgba(74,143,184,0.80) 100%)',
        }} />
        <Box sx={{ position: 'relative', p: { xs: 3, md: 5 }, color: 'white' }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.4rem' }, mb: 1 }}>
            📅 Lịch hẹn khám bệnh
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', opacity: 0.9, mb: 3, maxWidth: 480 }}>
            Quản lý các cuộc hẹn với bác sĩ. Đặt lịch khám kịp thời để bảo vệ sức khoẻ.
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenAdd(true)}
              sx={{
                bgcolor: 'white', color: '#2E5C7F',
                fontWeight: 700, fontSize: '1rem',
                borderRadius: '12px', px: 3, py: 1.25,
                '&:hover': { bgcolor: '#EBF4FB' },
              }}
            >
              Đặt lịch mới
            </Button>
            <Button
              variant="outlined"
              startIcon={<SmartToyIcon />}
              onClick={() => openChat('Tôi cần tư vấn về việc khám bác sĩ và chuẩn bị trước khi đi khám')}
              sx={{
                borderColor: 'rgba(255,255,255,0.7)', color: 'white',
                fontWeight: 600, fontSize: '1rem',
                borderRadius: '12px', px: 3, py: 1.25,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', borderColor: 'white' },
              }}
            >
              Hỏi AI
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Tab toggle */}
      <Box display="flex" gap={1} mb={3}>
        {(['upcoming', 'all'] as const).map((t) => (
          <Chip
            key={t}
            label={t === 'upcoming' ? '📆 Sắp tới (30 ngày)' : '📋 Tất cả'}
            onClick={() => setTab(t)}
            sx={{
              fontWeight: 700, fontSize: '1rem', px: 1,
              bgcolor: tab === t ? '#2E5C7F' : 'white',
              color: tab === t ? 'white' : '#7A8B99',
              border: `1.5px solid ${tab === t ? '#2E5C7F' : '#E0E0E0'}`,
              '&:hover': { bgcolor: tab === t ? '#1A4A6A' : '#F0F8FF' },
            }}
          />
        ))}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>}

      {/* AI Reminder Banner */}
      <Box
        sx={{
          p: 2.5, mb: 3, borderRadius: '16px',
          background: 'linear-gradient(135deg, #EBF4FB 0%, #E8F5EE 100%)',
          border: '1px solid #C8E6FA',
          display: 'flex', alignItems: 'center', gap: 2,
          cursor: 'pointer',
          '&:hover': { opacity: 0.9 },
        }}
        onClick={() => openChat('Tôi cần tư vấn về việc khám bác sĩ và chuẩn bị trước khi đi khám')}
      >
        <Box sx={{
          width: 48, height: 48, borderRadius: '12px',
          background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <SmartToyIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, color: '#2E5C7F', fontSize: '1rem' }}>
            AI hỗ trợ chuẩn bị trước khi khám
          </Typography>
          <Typography sx={{ color: '#4A8FB8', fontSize: '0.9rem' }}>
            Hỏi AI về cách mô tả triệu chứng, chuẩn bị câu hỏi cho bác sĩ →
          </Typography>
        </Box>
      </Box>

      {/* ── Prep Tips ────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5, mb: 3 }}>
        {[
          { icon: '📋', tip: 'Mang theo hồ sơ bệnh án và kết quả xét nghiệm cũ' },
          { icon: '💊', tip: 'Liệt kê tất cả thuốc đang dùng trước khi đi khám' },
          { icon: '❓', tip: 'Chuẩn bị sẵn câu hỏi cho bác sĩ' },
          { icon: '⏰', tip: 'Đến trước 15 phút để làm thủ tục đăng ký' },
          { icon: '🍽️', tip: 'Nhịn ăn 8 tiếng nếu cần xét nghiệm máu' },
        ].map((item, i) => (
          <Box key={i} sx={{
            minWidth: 150, p: 1.5, borderRadius: '14px',
            bgcolor: 'white', border: '1.5px solid #E2E8F0', flexShrink: 0,
            transition: 'all 0.25s', cursor: 'default',
            '&:hover': { borderColor: '#2E5C7F', transform: 'translateY(-3px)', boxShadow: '0 6px 20px rgba(46,92,127,0.12)' },
            '@keyframes tipIn': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
            animation: `tipIn 0.4s ease ${i * 0.08}s both`,
          }}>
            <Typography sx={{ fontSize: '1.4rem', mb: 0.5 }}>{item.icon}</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>{item.tip}</Typography>
          </Box>
        ))}
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={48} sx={{ color: '#2E5C7F' }} />
        </Box>
      ) : appointments.length === 0 ? (
        <Box
          sx={{
            p: 5, borderRadius: '20px',
            border: '2px dashed #C8D8E8',
            bgcolor: '#F0F8FF',
            textAlign: 'center',
          }}
        >
          <CalendarMonthIcon sx={{ fontSize: '5rem', color: '#C8D8E8', mb: 2 }} />
          <Typography sx={{ fontSize: '1.2rem', color: '#7A8B99', fontWeight: 600, mb: 1 }}>
            Chưa có lịch hẹn nào
          </Typography>
          <Typography sx={{ color: '#A0ADB8', mb: 3 }}>
            Nhấn "Đặt lịch mới" để thêm lịch hẹn với bác sĩ
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAdd(true)}
            sx={{
              bgcolor: '#2E5C7F', fontWeight: 700, fontSize: '1rem',
              borderRadius: '12px', px: 3,
              '&:hover': { bgcolor: '#1A4A6A' },
            }}
          >
            Đặt lịch ngay
          </Button>
        </Box>
      ) : (
        <Box>
          {grouped.upcoming.length > 0 && (
            <Box mb={3}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#2E5C7F', mb: 2 }}>
                Sắp tới ({grouped.upcoming.length})
              </Typography>
              <Grid container spacing={2}>
                {grouped.upcoming.map((appt, idx) => (
                  <Grid item xs={12} md={6} key={appt.id} sx={{
                    '@keyframes apptIn': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                    animation: `apptIn 0.4s ease ${idx * 0.1}s both`,
                  }}>
                    <AppointmentCard appt={appt} onCancel={(id) => setCancelTarget(id)} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {tab === 'all' && grouped.past.length > 0 && (
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#7A8B99', mb: 2 }}>
                Đã qua ({grouped.past.length})
              </Typography>
              <Grid container spacing={2}>
                {grouped.past.map((appt) => (
                  <Grid item xs={12} md={6} key={appt.id}>
                    <AppointmentCard appt={appt} onCancel={(id) => setCancelTarget(id)} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}

      {/* ── Book Appointment Dialog ───────────────────────────────────────── */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#2E5C7F', pb: 1 }}>
          📅 Đặt lịch hẹn mới
        </DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2.5} pt={1}>
            <TextField
              label="Tên bác sĩ *"
              value={form.doctorName}
              onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
              fullWidth
              placeholder="BS. Nguyễn Văn A"
              InputProps={{ sx: { borderRadius: '10px', fontSize: '1rem' } }}
            />

            <Box>
              <TextField
                label="Chuyên khoa"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                fullWidth
                placeholder="Tim mạch, Nội khoa..."
                InputProps={{ sx: { borderRadius: '10px' } }}
              />
              <Stack direction="row" flexWrap="wrap" gap={0.75} mt={1}>
                {SPECIALTY_QUICK_PICKS.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    onClick={() => setForm({ ...form, specialty: s })}
                    sx={{
                      fontSize: '0.85rem', cursor: 'pointer',
                      bgcolor: form.specialty === s ? '#2E5C7F' : '#EBF4FB',
                      color: form.specialty === s ? 'white' : '#2E5C7F',
                      fontWeight: form.specialty === s ? 700 : 500,
                    }}
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              select
              label="Loại khám"
              value={form.appointmentType}
              onChange={(e) => setForm({ ...form, appointmentType: e.target.value as any })}
              fullWidth
              InputProps={{ sx: { borderRadius: '10px' } }}
            >
              <MenuItem value="CLINIC">🏥 Phòng khám</MenuItem>
              <MenuItem value="TELEMEDICINE">💻 Khám từ xa</MenuItem>
              <MenuItem value="HOME_VISIT">🏠 Khám tại nhà</MenuItem>
            </TextField>

            <TextField
              label="Tên bệnh viện / phòng khám"
              value={form.hospitalName}
              onChange={(e) => setForm({ ...form, hospitalName: e.target.value })}
              fullWidth
              InputProps={{ sx: { borderRadius: '10px' } }}
            />
            <TextField
              label="Địa chỉ"
              value={form.hospitalAddress}
              onChange={(e) => setForm({ ...form, hospitalAddress: e.target.value })}
              fullWidth
              InputProps={{ sx: { borderRadius: '10px' } }}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Ngày & Giờ hẹn *"
                  type="datetime-local"
                  value={form.appointmentDate}
                  onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Thời lượng (phút)"
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: +e.target.value })}
                  fullWidth
                  inputProps={{ min: 15, max: 120, step: 15 }}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                />
              </Grid>
            </Grid>

            <TextField
              label="Lý do khám"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="Mô tả triệu chứng hoặc lý do khám..."
              InputProps={{ sx: { borderRadius: '10px' } }}
            />
            <TextField
              label="Ghi chú thêm"
              value={form.notes}
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
            disabled={saving || !form.doctorName || !form.appointmentDate}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
            sx={{
              fontSize: '1rem', fontWeight: 700, borderRadius: '10px', px: 3,
              bgcolor: '#2E5C7F',
              '&:hover': { bgcolor: '#1A4A6A' },
            }}
          >
            {saving ? 'Đang lưu...' : 'Xác nhận đặt lịch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelTarget} onClose={() => setCancelTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, color: '#E76F51' }}>
          <WarningAmberIcon /> Xác nhận huỷ lịch hẹn
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '1rem' }}>
            Bạn có chắc muốn huỷ lịch hẹn này không? Hành động này không thể hoàn tác.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, gap: 1 }}>
          <Button
            onClick={() => setCancelTarget(null)}
            sx={{ fontSize: '1rem', borderRadius: '10px' }}
          >
            Không, giữ lại
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => cancelTarget && handleCancel(cancelTarget)}
            sx={{ fontWeight: 700, fontSize: '1rem', borderRadius: '10px', px: 3 }}
          >
            Huỷ lịch hẹn
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ── Appointment Card Component ──────────────────────────────────────────────────

function getCountdownLabel(apptDate: Date): { label: string; color: string; bgcolor: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const apptDay = new Date(apptDate);
  apptDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((apptDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0)    return { label: `${Math.abs(diffDays)} ngày trước`, color: '#7A8B99', bgcolor: '#F0F2F5' };
  if (diffDays === 0)  return { label: 'Hôm nay!', color: '#FFFFFF', bgcolor: '#E76F51' };
  if (diffDays === 1)  return { label: 'Ngày mai', color: '#FFFFFF', bgcolor: '#E88D5D' };
  if (diffDays <= 7)   return { label: `${diffDays} ngày nữa`, color: '#FFFFFF', bgcolor: '#4A8FB8' };
  return { label: `${diffDays} ngày nữa`, color: '#2E5C7F', bgcolor: '#EBF4FB' };
}

interface AppointmentCardProps {
  appt: Appointment;
  onCancel: (id: string) => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ appt, onCancel }) => {
  const typeInfo = TYPE_LABELS[appt.appointmentType] || TYPE_LABELS.CLINIC;
  const statusInfo = STATUS_LABELS[appt.status] || STATUS_LABELS.SCHEDULED;

  const apptDate = new Date(appt.appointmentDate);
  const isUpcoming = appt.status === 'SCHEDULED';
  const countdown = isUpcoming ? getCountdownLabel(apptDate) : null;

  return (
    <Box
      sx={{
        borderRadius: '18px',
        border: `1.5px solid ${isUpcoming ? '#C8E6FA' : '#E8EDF2'}`,
        bgcolor: 'white',
        overflow: 'hidden',
        boxShadow: isUpcoming
          ? '0 4px 20px rgba(46,92,127,0.1)'
          : '0 2px 8px rgba(0,0,0,0.05)',
        '&:hover': { boxShadow: '0 6px 28px rgba(46,92,127,0.15)' },
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Card top accent */}
      <Box sx={{
        height: 4,
        background: isUpcoming
          ? 'linear-gradient(90deg, #2E5C7F 0%, #4A8FB8 100%)'
          : '#E8EDF2',
      }} />

      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box display="flex" alignItems="center" gap={1.5} flex={1} minWidth={0}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '12px',
              bgcolor: typeInfo.color + '15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: typeInfo.color, flexShrink: 0,
            }}>
              {typeInfo.icon}
            </Box>
            <Box minWidth={0}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#2C3E50' }} noWrap>
                {appt.doctorName}
              </Typography>
              {appt.specialty && (
                <Typography sx={{ fontSize: '0.88rem', color: '#5A6B7B' }}>
                  {appt.specialty}
                </Typography>
              )}
            </Box>
          </Box>
          <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5} flexShrink={0} ml={1}>
            {countdown && (
              <Chip
                label={countdown.label}
                size="small"
                sx={{ fontWeight: 700, fontSize: '0.8rem', bgcolor: countdown.bgcolor, color: countdown.color }}
              />
            )}
            <Chip
              label={statusInfo.label}
              color={statusInfo.color}
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.8rem' }}
            />
          </Box>
        </Box>

        {appt.hospitalName && (
          <Box display="flex" alignItems="center" gap={0.75} mb={1}>
            <Typography sx={{ fontSize: '0.9rem', color: '#5A6B7B' }}>
              🏥 {appt.hospitalName}
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            p: 1.5, borderRadius: '10px',
            bgcolor: isUpcoming ? '#EBF4FB' : '#F5F7FA',
            mt: 1,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: typeInfo.color }}>
            🕐 {apptDate.toLocaleString('vi-VN', {
              weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Typography>
          <Typography sx={{ fontSize: '0.88rem', color: '#7A8B99', mt: 0.25 }}>
            {typeInfo.label} • {appt.durationMinutes} phút
          </Typography>
        </Box>

        {appt.reason && (
          <Typography sx={{ fontSize: '0.9rem', color: '#5A6B7B', mt: 1.5, fontStyle: 'italic' }}>
            📋 {appt.reason}
          </Typography>
        )}

        {isUpcoming && (
          <Box mt={2} display="flex" justifyContent="flex-end">
            <Tooltip title="Huỷ lịch hẹn">
              <Button
                startIcon={<CancelIcon />}
                size="small"
                color="error"
                variant="outlined"
                onClick={() => onCancel(appt.id)}
                sx={{ borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}
              >
                Huỷ lịch
              </Button>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AppointmentPage;
