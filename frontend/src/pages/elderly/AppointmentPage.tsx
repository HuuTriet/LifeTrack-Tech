import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import VideocamIcon from '@mui/icons-material/Videocam';
import HomeIcon from '@mui/icons-material/Home';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HighContrastCard from '../../components/common/HighContrastCard';
import ElderlyButton from '../../components/common/ElderlyButton';
import { appointmentService, Appointment, CreateAppointmentPayload } from '../../services/appointmentService';
import { useAuthStore } from '../../store/authStore';

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
  const getElderlyId = useAuthStore((s) => s.getElderlyId);
  const elderlyId = getElderlyId() ?? '';

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState<CreateAppointmentPayload>({ ...INITIAL_FORM, elderlyId });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'all'>('upcoming');

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
      load();
    } catch {
      setError('Không thể huỷ lịch hẹn.');
    }
  };

  const grouped = {
    upcoming: appointments.filter(a => a.status === 'SCHEDULED'),
    past: appointments.filter(a => a.status !== 'SCHEDULED'),
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2E5C7F', fontSize: { xs: '1.6rem', md: '2rem' } }}>
            📅 Lịch hẹn khám bệnh
          </Typography>
          <Typography sx={{ color: '#7A8B99', mt: 0.5 }}>
            Quản lý các cuộc hẹn với bác sĩ và cơ sở y tế
          </Typography>
        </Box>
        <ElderlyButton icon={<AddIcon />} onClick={() => setOpenAdd(true)}>
          Đặt lịch mới
        </ElderlyButton>
      </Box>

      {/* Tab toggle */}
      <Box display="flex" gap={1} mb={3}>
        {(['upcoming', 'all'] as const).map((t) => (
          <Chip
            key={t}
            label={t === 'upcoming' ? 'Sắp tới (30 ngày)' : 'Tất cả'}
            onClick={() => setTab(t)}
            color={tab === t ? 'primary' : 'default'}
            sx={{ fontWeight: 600, fontSize: '1rem', px: 1 }}
          />
        ))}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={48} />
        </Box>
      ) : appointments.length === 0 ? (
        <HighContrastCard title="" accentColor="#4A8FB8">
          <Box textAlign="center" py={4}>
            <CalendarMonthIcon sx={{ fontSize: '5rem', color: '#C8D8E8', mb: 2 }} />
            <Typography sx={{ fontSize: '1.2rem', color: '#7A8B99', fontWeight: 600 }}>
              Chưa có lịch hẹn nào
            </Typography>
            <Typography sx={{ color: '#A0ADB8', mt: 1 }}>
              Nhấn "Đặt lịch mới" để thêm lịch hẹn
            </Typography>
          </Box>
        </HighContrastCard>
      ) : (
        <Box>
          {grouped.upcoming.length > 0 && (
            <Box mb={3}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#2E5C7F', mb: 1.5 }}>
                Sắp tới ({grouped.upcoming.length})
              </Typography>
              <Grid container spacing={2}>
                {grouped.upcoming.map((appt) => (
                  <Grid item xs={12} md={6} key={appt.id}>
                    <AppointmentCard appt={appt} onCancel={handleCancel} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {tab === 'all' && grouped.past.length > 0 && (
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#7A8B99', mb: 1.5 }}>
                Đã qua ({grouped.past.length})
              </Typography>
              <Grid container spacing={2}>
                {grouped.past.map((appt) => (
                  <Grid item xs={12} md={6} key={appt.id}>
                    <AppointmentCard appt={appt} onCancel={handleCancel} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}

      {/* Add Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.3rem', color: '#2E5C7F' }}>
          📅 Đặt lịch hẹn mới
        </DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2.5} pt={1}>
            <TextField
              label="Tên bác sĩ *"
              value={form.doctorName}
              onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
              fullWidth
              inputProps={{ style: { fontSize: '1rem' } }}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Chuyên khoa"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  fullWidth
                  placeholder="Tim mạch, Nội khoa..."
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Loại khám"
                  value={form.appointmentType}
                  onChange={(e) => setForm({ ...form, appointmentType: e.target.value as any })}
                  fullWidth
                >
                  <MenuItem value="CLINIC">Phòng khám</MenuItem>
                  <MenuItem value="TELEMEDICINE">Khám từ xa</MenuItem>
                  <MenuItem value="HOME_VISIT">Khám tại nhà</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <TextField
              label="Tên bệnh viện / phòng khám"
              value={form.hospitalName}
              onChange={(e) => setForm({ ...form, hospitalName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Địa chỉ"
              value={form.hospitalAddress}
              onChange={(e) => setForm({ ...form, hospitalAddress: e.target.value })}
              fullWidth
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
            />
            <TextField
              label="Ghi chú thêm"
              value={form.notes}
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
            disabled={saving || !form.doctorName || !form.appointmentDate}
            icon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
          >
            {saving ? 'Đang lưu...' : 'Xác nhận'}
          </ElderlyButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ── Appointment Card Component ──────────────────────────────────────────────────

interface AppointmentCardProps {
  appt: Appointment;
  onCancel: (id: string) => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ appt, onCancel }) => {
  const typeInfo = TYPE_LABELS[appt.appointmentType] || TYPE_LABELS.CLINIC;
  const statusInfo = STATUS_LABELS[appt.status] || STATUS_LABELS.SCHEDULED;

  const apptDate = new Date(appt.appointmentDate);
  const isUpcoming = appt.status === 'SCHEDULED';

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: '16px',
        border: `2px solid ${isUpcoming ? '#C8E6FA' : '#E8EDF2'}`,
        bgcolor: isUpcoming ? '#F0F8FF' : '#F9FAFB',
        position: 'relative',
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ color: typeInfo.color, display: 'flex' }}>{typeInfo.icon}</Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#2C3E50' }}>
            {appt.doctorName}
          </Typography>
        </Box>
        <Chip
          label={statusInfo.label}
          color={statusInfo.color}
          size="small"
          sx={{ fontWeight: 700, fontSize: '0.85rem' }}
        />
      </Box>

      {appt.specialty && (
        <Typography sx={{ fontSize: '0.95rem', color: '#5A6B7B', mb: 0.5 }}>
          🔬 {appt.specialty}
        </Typography>
      )}

      {appt.hospitalName && (
        <Typography sx={{ fontSize: '0.95rem', color: '#5A6B7B', mb: 0.5 }}>
          🏥 {appt.hospitalName}
        </Typography>
      )}

      <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: typeInfo.color, mt: 1.5 }}>
        🕐 {apptDate.toLocaleString('vi-VN', {
          weekday: 'short', day: 'numeric', month: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </Typography>

      <Typography sx={{ fontSize: '0.9rem', color: '#7A8B99', mt: 0.5 }}>
        {typeInfo.label} • {appt.durationMinutes} phút
      </Typography>

      {appt.reason && (
        <Typography sx={{ fontSize: '0.9rem', color: '#5A6B7B', mt: 1, fontStyle: 'italic' }}>
          📋 {appt.reason}
        </Typography>
      )}

      {isUpcoming && (
        <Box mt={2}>
          <Tooltip title="Huỷ lịch hẹn">
            <Button
              startIcon={<CancelIcon />}
              size="small"
              color="error"
              variant="outlined"
              onClick={() => onCancel(appt.id)}
              sx={{ borderRadius: '8px', fontSize: '0.9rem' }}
            >
              Huỷ lịch
            </Button>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default AppointmentPage;
