import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Alert,
  FormControlLabel, Checkbox, Link, CircularProgress,
  InputAdornment, IconButton, Divider,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const schema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
  rememberMe: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

const FEATURES = [
  'Theo dõi chỉ số sức khoẻ hàng ngày',
  'Nhắc nhở uống thuốc thông minh',
  'Đặt lịch hẹn bác sĩ dễ dàng',
  'Trợ lý AI hỗ trợ 24/7',
];

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', data);
      const { user, accessToken } = res.data;
      setAuth(user, accessToken);
      const role = user.role?.toLowerCase();
      if (role === 'admin') navigate('/admin/users');
      else if (role === 'caregiver') navigate('/caregiver/dashboard');
      else navigate('/elderly/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Đăng nhập thất bại. Kiểm tra lại thông tin.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* ── LEFT PANEL: Image + Branding ─────────────────────────────────── */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: '55%',
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        {/* Background medical image */}
        <Box
          component="img"
          src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1200&q=80"
          alt="Medical"
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
        {/* Dark overlay */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(10,40,70,0.45) 0%, rgba(10,40,70,0.85) 100%)',
        }} />

        {/* Content over image */}
        <Box sx={{ position: 'relative', p: { md: 5, lg: 7 }, color: 'white' }}>
          {/* Logo */}
          <Box display="flex" alignItems="center" gap={1.5} mb={4}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '14px',
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 800, color: 'white',
            }}>
              LT
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>LifeTrack Tech</Typography>
              <Typography sx={{ fontSize: '0.85rem', opacity: 0.75 }}>Hệ thống Quản lý Sức khoẻ</Typography>
            </Box>
          </Box>

          <Typography sx={{ fontWeight: 800, fontSize: '2.4rem', lineHeight: 1.2, mb: 2 }}>
            Sức khoẻ của bạn,<br />chúng tôi luôn đồng hành.
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', opacity: 0.85, mb: 4, maxWidth: 440 }}>
            Nền tảng y tế thông minh giúp người cao tuổi theo dõi sức khoẻ, quản lý thuốc và kết nối với đội ngũ y tế dễ dàng.
          </Typography>

          {/* Feature list */}
          <Box display="flex" flexDirection="column" gap={1.5}>
            {FEATURES.map((f) => (
              <Box key={f} display="flex" alignItems="center" gap={1.5}>
                <CheckCircleOutlineIcon sx={{ color: '#52D9A4', fontSize: '1.3rem', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.97rem', opacity: 0.9 }}>{f}</Typography>
              </Box>
            ))}
          </Box>

          {/* Hospital badges */}
          <Box display="flex" gap={2} mt={4} flexWrap="wrap">
            {['Được chứng nhận ISO 27001', 'Bảo mật dữ liệu y tế', 'Hỗ trợ 24/7'].map((badge) => (
              <Box key={badge} sx={{
                px: 1.5, py: 0.75,
                bgcolor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.25)',
                fontSize: '0.8rem',
              }}>
                {badge}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── RIGHT PANEL: Login Form ───────────────────────────────────────── */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: '#F8FAFC',
        p: { xs: 3, sm: 6 },
      }}>
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 4 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'linear-gradient(135deg, #0077B6 0%, #00B4D8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: '1rem',
            }}>LT</Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#0077B6' }}>LifeTrack Tech</Typography>
          </Box>

          <Typography sx={{ fontWeight: 800, fontSize: '2rem', color: '#0D1B2A', mb: 0.5 }}>
            Đăng nhập
          </Typography>
          <Typography sx={{ color: '#64748B', mb: 3 }}>
            Chào mừng trở lại! Vui lòng nhập thông tin của bạn.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '12px', fontSize: '0.95rem' }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box mb={2.5}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151', mb: 0.75 }}>
                Địa chỉ Email
              </Typography>
              <TextField
                fullWidth
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                error={!!errors.email}
                helperText={errors.email?.message}
                InputProps={{ sx: { borderRadius: '12px', bgcolor: 'white', fontSize: '1rem' } }}
                {...register('email')}
              />
            </Box>

            <Box mb={1.5}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151', mb: 0.75 }}>
                Mật khẩu
              </Typography>
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  sx: { borderRadius: '12px', bgcolor: 'white', fontSize: '1rem' },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(v => !v)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                {...register('password')}
              />
            </Box>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <FormControlLabel
                control={<Checkbox size="small" sx={{ color: '#0077B6' }} {...register('rememberMe')} />}
                label={<Typography sx={{ fontSize: '0.9rem', color: '#374151' }}>Ghi nhớ đăng nhập (30 ngày)</Typography>}
              />
              <Link component={RouterLink} to="/forgot-password" sx={{ fontSize: '0.9rem', color: '#0077B6', fontWeight: 600, textDecoration: 'none' }}>
                Quên mật khẩu?
              </Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{
                py: 1.75, borderRadius: '12px',
                fontSize: '1.05rem', fontWeight: 700,
                background: 'linear-gradient(135deg, #0077B6 0%, #00B4D8 100%)',
                boxShadow: '0 4px 20px rgba(0,119,182,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #005a8a 0%, #0096b7 100%)' },
              }}
            >
              {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Đăng nhập'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography sx={{ fontSize: '0.85rem', color: '#94A3B8' }}>hoặc</Typography>
          </Divider>

          <Typography sx={{ textAlign: 'center', fontSize: '0.95rem', color: '#64748B' }}>
            Chưa có tài khoản?{' '}
            <Link component={RouterLink} to="/register" sx={{ color: '#0077B6', fontWeight: 700, textDecoration: 'none' }}>
              Đăng ký ngay
            </Link>
          </Typography>

          {/* Trust indicators */}
          <Box display="flex" justifyContent="center" gap={3} mt={4}>
            {['🔒 Bảo mật SSL', '🏥 Chuẩn y tế', '✅ Đã kiểm duyệt'].map(t => (
              <Typography key={t} sx={{ fontSize: '0.78rem', color: '#94A3B8' }}>{t}</Typography>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
