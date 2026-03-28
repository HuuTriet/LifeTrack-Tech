import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  CircularProgress,
  InputAdornment,
  IconButton,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { Visibility, VisibilityOff, HealthAndSafety } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  phoneNumber: z.string().optional(),
  password: z
    .string()
    .min(8)
    .regex(passwordPattern, 'Must contain uppercase, lowercase, number, and special character'),
  role: z.enum(['ELDERLY', 'CAREGIVER', 'ADMIN']),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

type RegisterData = z.infer<typeof registerSchema>;
type OtpData = z.infer<typeof otpSchema>;

const STEPS = ['Create Account', 'Verify Email'];

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register: regRegister,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors, isSubmitting: isRegisterSubmitting },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  const {
    register: otpRegister,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors, isSubmitting: isOtpSubmitting },
  } = useForm<OtpData>({ resolver: zodResolver(otpSchema) });

  const onRegister = async (data: RegisterData) => {
    setError(null);
    try {
      await api.post('/auth/register', data);
      setEmail(data.email);
      setSuccess(
        'Registration successful! Please check your email for the 6-digit verification code.',
      );
      setStep(1);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const onVerify = async (data: OtpData) => {
    setError(null);
    try {
      const res = await api.post('/auth/verify-email', { email, otp: data.otp });
      const { user, accessToken } = res.data;
      setAuth(user, accessToken);

      const role = user.role?.toLowerCase();
      if (role === 'admin') navigate('/admin/users');
      else if (role === 'caregiver') navigate('/caregiver/dashboard');
      else navigate('/elderly/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Verification failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    try {
      await api.post('/auth/resend-otp', { email });
      setSuccess('A new verification code has been sent to your email.');
    } catch {
      setError('Failed to resend verification code. Please try again.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2E5C7F 0%, #1A3D5C 100%)',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 480, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <HealthAndSafety sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight={700} color="primary.main">
              LifeTrack Tech
            </Typography>
          </Box>

          <Stepper activeStep={step} sx={{ mb: 3 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          {step === 0 && (
            <Box component="form" onSubmit={handleRegisterSubmit(onRegister)} noValidate>
              <TextField
                fullWidth
                label="Full Name"
                sx={{ mb: 2 }}
                error={!!registerErrors.fullName}
                helperText={registerErrors.fullName?.message}
                {...regRegister('fullName')}
              />
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                sx={{ mb: 2 }}
                error={!!registerErrors.email}
                helperText={registerErrors.email?.message}
                {...regRegister('email')}
              />
              <TextField
                fullWidth
                label="Phone Number (optional)"
                sx={{ mb: 2 }}
                {...regRegister('phoneNumber')}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                sx={{ mb: 2 }}
                error={!!registerErrors.password}
                helperText={
                  registerErrors.password?.message ||
                  'Min 8 chars, uppercase, lowercase, number, special character'
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                {...regRegister('password')}
              />
              <TextField
                fullWidth
                select
                label="Role"
                sx={{ mb: 3 }}
                error={!!registerErrors.role}
                helperText={registerErrors.role?.message}
                defaultValue="ELDERLY"
                {...regRegister('role')}
              >
                <MenuItem value="ELDERLY">Elderly User</MenuItem>
                <MenuItem value="CAREGIVER">Caregiver</MenuItem>
              </TextField>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isRegisterSubmitting}
                sx={{ mb: 2, py: 1.5 }}
              >
                {isRegisterSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Create Account'
                )}
              </Button>

              <Typography variant="body2" align="center" color="text.secondary">
                Already have an account?{' '}
                <Link component={RouterLink} to="/login" color="primary" fontWeight={600}>
                  Sign In
                </Link>
              </Typography>
            </Box>
          )}

          {step === 1 && (
            <Box component="form" onSubmit={handleOtpSubmit(onVerify)} noValidate>
              <Typography variant="body1" mb={2}>
                Enter the 6-digit code sent to <strong>{email}</strong>
              </Typography>

              <TextField
                fullWidth
                label="Verification Code"
                inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                sx={{ mb: 3 }}
                error={!!otpErrors.otp}
                helperText={otpErrors.otp?.message}
                {...otpRegister('otp')}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isOtpSubmitting}
                sx={{ mb: 2, py: 1.5 }}
              >
                {isOtpSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Verify Email'}
              </Button>

              <Button
                fullWidth
                variant="text"
                onClick={handleResendOtp}
                sx={{ mb: 1 }}
              >
                Resend Code
              </Button>

              <Button
                fullWidth
                variant="text"
                color="inherit"
                onClick={() => { setStep(0); setSuccess(null); setError(null); }}
              >
                Back
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterPage;
