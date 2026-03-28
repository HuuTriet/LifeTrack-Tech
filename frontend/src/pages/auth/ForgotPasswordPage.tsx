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
  Stepper,
  Step,
  StepLabel,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { HealthAndSafety, Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../services/api';

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

const resetSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit code'),
  newPassword: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Must contain uppercase, lowercase, number, and special character',
    ),
});

type EmailData = z.infer<typeof emailSchema>;
type ResetData = z.infer<typeof resetSchema>;

const STEPS = ['Enter Email', 'Reset Password'];

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register: emailReg,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors, isSubmitting: isEmailSubmitting },
  } = useForm<EmailData>({ resolver: zodResolver(emailSchema) });

  const {
    register: resetReg,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors, isSubmitting: isResetSubmitting },
  } = useForm<ResetData>({ resolver: zodResolver(resetSchema) });

  const onRequestReset = async (data: EmailData) => {
    setError(null);
    try {
      const res = await api.post('/auth/forgot-password', data);
      setEmail(data.email);
      // Always show generic message per security requirement
      setSuccessMsg(res.data.message);
      setStep(1);
    } catch {
      setError('Something went wrong. Please try again later.');
    }
  };

  const onResetPassword = async (data: ResetData) => {
    setError(null);
    try {
      await api.post('/auth/reset-password', {
        email,
        token: data.otp,
        newPassword: data.newPassword,
      });
      setSuccessMsg('Password reset successful! You can now sign in with your new password.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Reset failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
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
      <Card sx={{ maxWidth: 440, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <HealthAndSafety sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight={700} color="primary.main">
              LifeTrack Tech
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Password Recovery
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
          {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

          {step === 0 && (
            <Box component="form" onSubmit={handleEmailSubmit(onRequestReset)} noValidate>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Enter your registered email and we'll send you a reset code.
              </Typography>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                sx={{ mb: 3 }}
                error={!!emailErrors.email}
                helperText={emailErrors.email?.message}
                {...emailReg('email')}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isEmailSubmitting}
                sx={{ mb: 2, py: 1.5 }}
              >
                {isEmailSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Send Reset Code'
                )}
              </Button>
              <Typography variant="body2" align="center">
                <Link component={RouterLink} to="/login" color="primary">
                  Back to Sign In
                </Link>
              </Typography>
            </Box>
          )}

          {step === 1 && (
            <Box component="form" onSubmit={handleResetSubmit(onResetPassword)} noValidate>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Enter the 6-digit code sent to <strong>{email}</strong> and your new password.
                The code expires in 15 minutes.
              </Typography>
              <TextField
                fullWidth
                label="Verification Code"
                inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                sx={{ mb: 2 }}
                error={!!resetErrors.otp}
                helperText={resetErrors.otp?.message}
                {...resetReg('otp')}
              />
              <TextField
                fullWidth
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                sx={{ mb: 3 }}
                error={!!resetErrors.newPassword}
                helperText={
                  resetErrors.newPassword?.message ||
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
                {...resetReg('newPassword')}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isResetSubmitting}
                sx={{ mb: 2, py: 1.5 }}
              >
                {isResetSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Reset Password'
                )}
              </Button>
              <Button
                fullWidth
                variant="text"
                color="inherit"
                onClick={() => { setStep(0); setSuccessMsg(null); setError(null); }}
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

export default ForgotPasswordPage;
