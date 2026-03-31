import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, TextField, Button, Alert,
  CircularProgress, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, IconButton, Avatar, Paper, Tooltip,
} from '@mui/material';
import { Add, Edit, Archive, LocalHospital, ContactPhone, Person, Scale, Height, OpenInNew } from '@mui/icons-material';

import { useForm } from 'react-hook-form';
import api from '../../services/api';

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

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];

const GENDER_LABELS: Record<string, string> = {
  male: 'Nam', female: 'Nữ', other: 'Khác', '': 'Chưa rõ',
};

const BLOOD_COLORS: Record<string, string> = {
  'A+': '#E53E3E', 'A-': '#FC8181', 'B+': '#DD6B20', 'B-': '#FBD38D',
  'AB+': '#7B2D8B', 'AB-': '#B794F4', 'O+': '#2B6CB0', 'O-': '#90CDF4',
};

function getAge(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function getInitials(profile: ElderlyProfile) {
  const name = profile.user?.fullName || profile.user?.name || '';
  return name.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase() || '?';
}

const ElderlyProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ElderlyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } =
    useForm<Partial<ElderlyProfile> & { email: string }>();

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/elderly');
      const data = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setProfiles(data);
    } catch {
      setError('Không thể tải danh sách hồ sơ bệnh nhân.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfiles(); }, []);

  const openCreate = () => {
    reset();
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (profile: ElderlyProfile) => {
    setEditingId(profile.id);
    Object.entries(profile).forEach(([k, v]) => setValue(k as any, v as any));
    setDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    setError(null);
    try {
      if (editingId) {
        await api.put(`/elderly/${editingId}`, data);
        setSuccessMsg('Đã cập nhật hồ sơ thành công.');
      } else {
        await api.post('/elderly', data);
        setSuccessMsg('Đã tạo hồ sơ bệnh nhân thành công.');
      }
      setDialogOpen(false);
      fetchProfiles();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu hồ sơ. Vui lòng thử lại.');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await api.delete(`/elderly/${id}`);
      setSuccessMsg('Đã lưu trữ hồ sơ thành công.');
      setConfirmArchiveId(null);
      fetchProfiles();
    } catch {
      setError('Không thể lưu trữ hồ sơ.');
      setConfirmArchiveId(null);
    }
  };

  return (
    <Box sx={{
      '@keyframes fadeInPage': { from: { opacity: 0 }, to: { opacity: 1 } },
      animation: 'fadeInPage 0.4s ease',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        mb: 3, flexWrap: 'wrap', gap: 2,
      }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color: '#2E5C7F' }}>
            👥 Hồ sơ bệnh nhân
          </Typography>
          <Typography sx={{ color: '#7A8B99', fontSize: '0.9rem', mt: 0.3 }}>
            Quản lý thông tin y tế của người cao tuổi được chăm sóc
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{
            borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem',
            background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
            boxShadow: '0 4px 15px rgba(46,92,127,0.3)',
            px: 2.5, py: 1.1,
          }}
        >
          Thêm bệnh nhân
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress size={48} sx={{ color: '#2E5C7F' }} />
        </Box>
      ) : profiles.length === 0 ? (
        <Paper elevation={0} sx={{ borderRadius: '20px', border: '2px dashed #CBD5E1', p: 6, textAlign: 'center' }}>
          <Person sx={{ fontSize: 64, color: '#CBD5E1', mb: 2 }} />
          <Typography sx={{ color: '#64748B', fontSize: '1.1rem', fontWeight: 600, mb: 1 }}>
            Chưa có hồ sơ bệnh nhân nào
          </Typography>
          <Typography sx={{ color: '#94A3B8', mb: 3 }}>
            Nhấn "Thêm bệnh nhân" để tạo hồ sơ đầu tiên
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}
            sx={{ borderRadius: '12px', fontWeight: 700, bgcolor: '#2E5C7F', px: 3 }}>
            Thêm bệnh nhân đầu tiên
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {profiles.map((p, idx) => {
            const name = p.user?.fullName || p.user?.name || 'Chưa rõ';
            const age = getAge(p.dateOfBirth);
            const avatarColors = ['#2E5C7F', '#52B788', '#E76F51', '#E88D5D', '#9B59B6'];
            const avatarColor = avatarColors[idx % avatarColors.length];

            return (
              <Grid item xs={12} md={6} key={p.id} sx={{
                '@keyframes cardIn': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                animation: `cardIn 0.4s ease ${idx * 0.08}s both`,
              }}>
                <Paper elevation={0} sx={{
                  borderRadius: '20px', border: '1.5px solid #E2E8F0',
                  overflow: 'hidden', transition: 'all 0.25s', cursor: 'pointer',
                  '&:hover': { boxShadow: '0 8px 30px rgba(46,92,127,0.15)', transform: 'translateY(-3px)', borderColor: '#93C5FD' },
                }} onClick={() => navigate(`/caregiver/elderly/${p.id}`)}>
                  {/* Card header */}
                  <Box sx={{
                    p: 2.5, background: `linear-gradient(135deg, ${avatarColor}12 0%, ${avatarColor}06 100%)`,
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar sx={{ width: 52, height: 52, bgcolor: avatarColor, fontWeight: 700, fontSize: '1.1rem' }}>
                        {getInitials(p)}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#1E293B' }}>
                          {name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.82rem', color: '#64748B' }}>
                          {p.user?.email}
                        </Typography>
                        <Box display="flex" gap={0.75} mt={0.5} flexWrap="wrap">
                          {age !== null && (
                            <Chip label={`${age} tuổi`} size="small" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 600, fontSize: '0.75rem' }} />
                          )}
                          {p.gender && (
                            <Chip label={GENDER_LABELS[p.gender] || p.gender} size="small" sx={{ bgcolor: '#F0FDF4', color: '#15803D', fontSize: '0.75rem' }} />
                          )}
                          {p.roomNumber && (
                            <Chip label={`Phòng ${p.roomNumber}`} size="small" sx={{ bgcolor: '#FFF7ED', color: '#C2410C', fontSize: '0.75rem' }} />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Box display="flex" gap={0.5} alignItems="flex-start" onClick={e => e.stopPropagation()}>
                      {p.bloodType && p.bloodType !== 'UNKNOWN' && (
                        <Chip
                          label={p.bloodType}
                          size="small"
                          sx={{ bgcolor: `${BLOOD_COLORS[p.bloodType] || '#E53E3E'}20`, color: BLOOD_COLORS[p.bloodType] || '#E53E3E', fontWeight: 700, fontSize: '0.8rem' }}
                        />
                      )}
                      <Tooltip title="Xem chi tiết">
                        <IconButton size="small" onClick={() => navigate(`/caregiver/elderly/${p.id}`)} sx={{ bgcolor: '#EBF4FB', borderRadius: '8px' }}>
                          <OpenInNew sx={{ fontSize: '1rem', color: '#2E5C7F' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Chỉnh sửa">
                        <IconButton size="small" onClick={() => openEdit(p)} sx={{ bgcolor: '#F1F5F9', borderRadius: '8px' }}>
                          <Edit sx={{ fontSize: '1rem', color: '#2E5C7F' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Lưu trữ">
                        <IconButton size="small" onClick={() => setConfirmArchiveId(p.id)} sx={{ bgcolor: '#FEF0EC', borderRadius: '8px' }}>
                          <Archive sx={{ fontSize: '1rem', color: '#E76F51' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Card body */}
                  <Box sx={{ p: 2.5 }}>
                    <Grid container spacing={1.5}>
                      {p.weight && (
                        <Grid item xs={6}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Scale sx={{ fontSize: '1rem', color: '#94A3B8' }} />
                            <Box>
                              <Typography sx={{ fontSize: '0.72rem', color: '#94A3B8' }}>Cân nặng</Typography>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1E293B' }}>{p.weight} kg</Typography>
                            </Box>
                          </Box>
                        </Grid>
                      )}
                      {p.height && (
                        <Grid item xs={6}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Height sx={{ fontSize: '1rem', color: '#94A3B8' }} />
                            <Box>
                              <Typography sx={{ fontSize: '0.72rem', color: '#94A3B8' }}>Chiều cao</Typography>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1E293B' }}>{p.height} cm</Typography>
                            </Box>
                          </Box>
                        </Grid>
                      )}
                    </Grid>

                    {p.chronicConditions && (
                      <Box mt={1.5} p={1.5} sx={{ bgcolor: '#FFF7ED', borderRadius: '10px', border: '1px solid #FED7AA' }}>
                        <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
                          <LocalHospital sx={{ fontSize: '0.9rem', color: '#D97706' }} />
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706' }}>
                            BỆNH MÃN TÍNH
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.85rem', color: '#92400E' }}>{p.chronicConditions}</Typography>
                      </Box>
                    )}

                    {p.knownAllergies && (
                      <Box mt={1.25} p={1.5} sx={{ bgcolor: '#FFF5F5', borderRadius: '10px', border: '1px solid #FEE2E2' }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#DC2626', mb: 0.3 }}>⚠️ DỊ ỨNG</Typography>
                        <Typography sx={{ fontSize: '0.85rem', color: '#B91C1C' }}>{p.knownAllergies}</Typography>
                      </Box>
                    )}

                    {p.emergencyContactName && (
                      <Box mt={1.25} display="flex" alignItems="center" gap={1.25} p={1.5} sx={{ bgcolor: '#EFF6FF', borderRadius: '10px' }}>
                        <ContactPhone sx={{ fontSize: '1.2rem', color: '#2E5C7F' }} />
                        <Box>
                          <Typography sx={{ fontSize: '0.72rem', color: '#3B82F6', fontWeight: 700 }}>LIÊN HỆ KHẨN CẤP</Typography>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E40AF' }}>
                            {p.emergencyContactName}
                            {p.emergencyContactPhone && ` · ${p.emergencyContactPhone}`}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ── Create/Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#2E5C7F', pb: 1 }}>
          {editingId ? '✏️ Chỉnh sửa hồ sơ' : '➕ Thêm bệnh nhân mới'}
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" sx={{ pt: 1 }}>
            {!editingId && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Email tài khoản bệnh nhân *"
                  type="email"
                  placeholder="VD: nguyenvana@gmail.com"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  helperText="Nhập email tài khoản đã đăng ký của bệnh nhân"
                  {...register('email', { required: true })}
                />
              </Box>
            )}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth label="Ngày sinh" type="date"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('dateOfBirth')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Giới tính" defaultValue=""
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('gender')}>
                  <MenuItem value="">Chưa xác định</MenuItem>
                  <MenuItem value="male">Nam</MenuItem>
                  <MenuItem value="female">Nữ</MenuItem>
                  <MenuItem value="other">Khác</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Cân nặng (kg)" type="number"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('weight')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Chiều cao (cm)" type="number"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('height')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Nhóm máu" defaultValue="UNKNOWN"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('bloodType')}>
                  {BLOOD_TYPES.map((bt) => (
                    <MenuItem key={bt} value={bt}>{bt === 'UNKNOWN' ? 'Chưa rõ' : bt}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Số phòng"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('roomNumber')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Dị ứng đã biết" multiline rows={2}
                  placeholder="VD: Penicillin, Hải sản, Đậu phộng"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('knownAllergies')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Bệnh mãn tính" multiline rows={2}
                  placeholder="VD: Tăng huyết áp, Tiểu đường type 2"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('chronicConditions')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Người liên hệ khẩn cấp"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('emergencyContactName')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="SĐT khẩn cấp"
                  InputProps={{ sx: { borderRadius: '10px' } }}
                  {...register('emergencyContactPhone')} />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: '10px' }}>Huỷ</Button>
          <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}
            sx={{ borderRadius: '10px', fontWeight: 700, bgcolor: '#2E5C7F', px: 3 }}>
            {isSubmitting ? <CircularProgress size={18} color="inherit" /> : (editingId ? 'Cập nhật' : 'Tạo hồ sơ')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm Archive Dialog ────────────────────────────────────── */}
      <Dialog open={!!confirmArchiveId} onClose={() => setConfirmArchiveId(null)}
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: '#E76F51' }}>⚠️ Xác nhận lưu trữ</DialogTitle>
        <DialogContent>
          <Typography>Bạn có chắc muốn lưu trữ hồ sơ này? Hành động này có thể hoàn tác.</Typography>
        </DialogContent>
        <DialogActions sx={{ gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmArchiveId(null)} sx={{ borderRadius: '10px' }}>Huỷ</Button>
          <Button variant="contained" color="error" onClick={() => confirmArchiveId && handleArchive(confirmArchiveId)}
            sx={{ borderRadius: '10px', fontWeight: 700 }}>
            Lưu trữ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ElderlyProfilePage;
