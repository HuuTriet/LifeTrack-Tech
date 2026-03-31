import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Alert,
  CircularProgress, Chip, Divider, Switch, FormControlLabel,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MedicationIcon from '@mui/icons-material/Medication';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const STORAGE_KEY_EMAIL = 'lt_notif_email';
const STORAGE_KEY_VERIFIED = 'lt_notif_email_verified';
const STORAGE_KEY_PREFS = 'lt_notif_prefs';

interface NotifPrefs {
  medication: boolean;
  health: boolean;
  appointment: boolean;
}

const DEFAULT_PREFS: NotifPrefs = { medication: true, health: true, appointment: true };

const EmailNotificationSettingsPage: React.FC = () => {
  const { user } = useAuthStore();

  // Saved state (from localStorage)
  const [savedEmail, setSavedEmail] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  // Form state
  const [inputEmail, setInputEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [countdown, setCountdown] = useState(0);

  // UI state
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const email = localStorage.getItem(STORAGE_KEY_EMAIL) || user?.email || '';
    const verified = localStorage.getItem(STORAGE_KEY_VERIFIED) === 'true';
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    setSavedEmail(email);
    setInputEmail(email);
    setIsVerified(verified);
    if (raw) {
      try { setPrefs(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, [user?.email]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!inputEmail) return;
    setSending(true);
    setError(null);
    try {
      await api.post('/auth/notification-email/send-otp', { email: inputEmail });
      setOtpSent(true);
      setCountdown(60);
      setSuccess(`Mã xác thực đã được gửi tới ${inputEmail}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi mã. Kiểm tra địa chỉ email và thử lại.');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput || !inputEmail) return;
    setVerifying(true);
    setError(null);
    try {
      await api.post('/auth/notification-email/verify', { email: inputEmail, otp: otpInput });
      localStorage.setItem(STORAGE_KEY_EMAIL, inputEmail);
      localStorage.setItem(STORAGE_KEY_VERIFIED, 'true');
      setSavedEmail(inputEmail);
      setIsVerified(true);
      setOtpSent(false);
      setOtpInput('');
      setSuccess('Email đã được xác thực thành công! Bạn sẽ nhận thông báo thuốc tại địa chỉ này.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mã xác thực không đúng. Vui lòng thử lại.');
    } finally {
      setVerifying(false);
    }
  };

  const handleChangeEmail = () => {
    setIsVerified(false);
    localStorage.removeItem(STORAGE_KEY_VERIFIED);
    setOtpSent(false);
    setOtpInput('');
    setError(null);
    setSuccess(null);
  };

  const handlePrefChange = (key: keyof NotifPrefs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...prefs, [key]: e.target.checked };
    setPrefs(updated);
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(updated));
    setSuccess('Đã lưu cài đặt thông báo.');
  };

  return (
    <Box sx={{
      '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: 'fadeIn 0.4s ease',
      maxWidth: 640,
    }}>
      {/* Header */}
      <Box mb={3}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color: '#2E5C7F' }}>
          📧 Thông báo qua email
        </Typography>
        <Typography sx={{ color: '#7A8B99', fontSize: '0.9rem', mt: 0.5 }}>
          Xác thực email để nhận nhắc nhở uống thuốc và thông báo sức khoẻ
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Status Card */}
      <Paper elevation={0} sx={{ borderRadius: '20px', border: '1.5px solid #E2E8F0', p: 3, mb: 2.5 }}>
        <Box display="flex" alignItems="center" gap={1.5} mb={2}>
          <EmailIcon sx={{ color: '#2E5C7F', fontSize: '1.4rem' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B' }}>
            Email nhận thông báo
          </Typography>
        </Box>

        {isVerified ? (
          /* ── Verified state ── */
          <Box sx={{ bgcolor: '#F0FFF4', borderRadius: '14px', p: 2.5, border: '1.5px solid #BBF7D0' }}>
            <Box display="flex" alignItems="center" gap={1.5} mb={1}>
              <VerifiedIcon sx={{ color: '#16A34A', fontSize: '1.6rem' }} />
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#15803D' }}>
                  Đã xác thực
                </Typography>
                <Typography sx={{ fontSize: '0.88rem', color: '#166534', fontWeight: 600 }}>
                  {savedEmail}
                </Typography>
              </Box>
              <Chip label="✓ Đã xác thực" size="small"
                sx={{ ml: 'auto', bgcolor: '#DCFCE7', color: '#16A34A', fontWeight: 700 }} />
            </Box>
            <Typography sx={{ fontSize: '0.82rem', color: '#4ADE80', mb: 1.5 }}>
              Thông báo nhắc thuốc sẽ được gửi tới email này.
            </Typography>
            <Button variant="outlined" size="small" onClick={handleChangeEmail}
              sx={{ borderRadius: '10px', fontSize: '0.82rem', borderColor: '#16A34A', color: '#16A34A' }}>
              Đổi email khác
            </Button>
          </Box>
        ) : (
          /* ── Unverified / setup state ── */
          <Box>
            <Box sx={{
              bgcolor: '#FFFBEB', borderRadius: '12px', p: 2, mb: 2.5,
              border: '1px solid #FEF08A', display: 'flex', gap: 1, alignItems: 'flex-start',
            }}>
              <WarningAmberIcon sx={{ color: '#CA8A04', fontSize: '1.1rem', mt: 0.1 }} />
              <Typography sx={{ fontSize: '0.83rem', color: '#92400E' }}>
                Email chưa được xác thực. Hãy nhập email và xác thực bằng mã OTP để nhận nhắc nhở.
              </Typography>
            </Box>

            <Box display="flex" gap={1.5} alignItems="flex-start">
              <TextField
                fullWidth
                label="Địa chỉ email"
                type="email"
                value={inputEmail}
                onChange={e => { setInputEmail(e.target.value); setOtpSent(false); }}
                placeholder="example@gmail.com"
                disabled={otpSent}
                InputProps={{ sx: { borderRadius: '12px' } }}
                size="small"
              />
              <Button
                variant="contained"
                onClick={handleSendOtp}
                disabled={sending || !inputEmail || countdown > 0}
                startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <EmailIcon />}
                sx={{
                  borderRadius: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                  bgcolor: '#2E5C7F', px: 2.5, py: 1,
                  '&:disabled': { bgcolor: '#CBD5E1' },
                }}
              >
                {countdown > 0 ? `Gửi lại (${countdown}s)` : (otpSent ? 'Gửi lại' : 'Gửi mã')}
              </Button>
            </Box>

            {otpSent && (
              <Box mt={2} sx={{
                '@keyframes slideIn': { from: { opacity: 0, transform: 'translateY(-6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                animation: 'slideIn 0.3s ease',
              }}>
                <Typography sx={{ fontSize: '0.83rem', color: '#64748B', mb: 1.5 }}>
                  Nhập mã 6 chữ số đã được gửi tới <strong>{inputEmail}</strong>
                </Typography>
                <Box display="flex" gap={1.5}>
                  <TextField
                    label="Mã xác thực (OTP)"
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputProps={{ maxLength: 6, style: { letterSpacing: '0.25em', fontWeight: 700, fontSize: '1.1rem' } }}
                    InputProps={{ sx: { borderRadius: '12px' } }}
                    size="small"
                    sx={{ width: 200 }}
                    onKeyDown={e => e.key === 'Enter' && otpInput.length === 6 && handleVerifyOtp()}
                  />
                  <Button
                    variant="contained"
                    onClick={handleVerifyOtp}
                    disabled={verifying || otpInput.length !== 6}
                    startIcon={verifying ? <CircularProgress size={14} color="inherit" /> : <VerifiedIcon />}
                    sx={{
                      borderRadius: '12px', fontWeight: 700,
                      bgcolor: '#52B788', px: 2.5,
                      '&:hover': { bgcolor: '#3A9D6B' },
                    }}
                  >
                    {verifying ? 'Đang xác thực...' : 'Xác thực'}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Notification Preferences */}
      <Paper elevation={0} sx={{
        borderRadius: '20px', border: '1.5px solid #E2E8F0', p: 3,
        opacity: isVerified ? 1 : 0.6, pointerEvents: isVerified ? 'auto' : 'none',
        transition: 'opacity 0.3s',
      }}>
        <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
          <NotificationsActiveIcon sx={{ color: '#2E5C7F', fontSize: '1.4rem' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B' }}>
            Loại thông báo nhận qua email
          </Typography>
        </Box>
        {!isVerified && (
          <Typography sx={{ fontSize: '0.8rem', color: '#94A3B8', mb: 2 }}>
            Xác thực email để kích hoạt cài đặt này
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {[
          {
            key: 'medication' as const,
            icon: <MedicationIcon sx={{ fontSize: '1.1rem', color: '#4A8FB8' }} />,
            label: 'Nhắc uống thuốc',
            desc: 'Nhận email nhắc nhở trước giờ uống thuốc với nút "Đã uống" và "Nhắc lại"',
            color: '#EBF4FB',
          },
          {
            key: 'health' as const,
            icon: <span style={{ fontSize: '1.1rem' }}>💓</span>,
            label: 'Cảnh báo sức khoẻ',
            desc: 'Nhận thông báo khi chỉ số sức khoẻ bất thường',
            color: '#FFF5F5',
          },
          {
            key: 'appointment' as const,
            icon: <span style={{ fontSize: '1.1rem' }}>📅</span>,
            label: 'Nhắc lịch hẹn',
            desc: 'Nhận email nhắc lịch khám bác sĩ trước 1 ngày',
            color: '#F0FFF4',
          },
        ].map((item, idx) => (
          <Box key={item.key} sx={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            p: 2, borderRadius: '14px', bgcolor: prefs[item.key] ? item.color : '#F8FAFC',
            mb: idx < 2 ? 1.5 : 0, transition: 'background 0.2s',
          }}>
            <Box display="flex" alignItems="flex-start" gap={1.5}>
              <Box sx={{ mt: 0.25 }}>{item.icon}</Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1E293B' }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748B', mt: 0.25 }}>
                  {item.desc}
                </Typography>
              </Box>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={prefs[item.key]}
                  onChange={handlePrefChange(item.key)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#2E5C7F' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#4A8FB8' },
                  }}
                />
              }
              label=""
              sx={{ m: 0 }}
            />
          </Box>
        ))}
      </Paper>

      {/* Info box */}
      <Box mt={2.5} p={2} sx={{ bgcolor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <Typography sx={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.6 }}>
          💡 <strong>Lưu ý:</strong> Email nhận thông báo có thể khác email đăng nhập. Bạn có thể nhập email của người thân hoặc người chăm sóc để họ cũng nhận được thông báo.
        </Typography>
      </Box>
    </Box>
  );
};

export default EmailNotificationSettingsPage;
