import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Grid,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Edit, Save, Lock } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const profileSchema = z.object({
  fullName: z.string().min(2),
  phoneNumber: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z
      .string()
      .min(8)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        'Must contain uppercase, lowercase, number, and special character',
      ),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

const ProfilePage: React.FC = () => {
  const { user, setAuth, token } = useAuthStore();
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const {
    register: profileReg,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
    setValue,
  } = useForm<ProfileData>({ resolver: zodResolver(profileSchema) });

  const {
    register: passReg,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passErrors, isSubmitting: isPassSubmitting },
    reset: resetPassword,
  } = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (user) {
      setValue('fullName', (user as any).fullName || user.name || '');
      setValue('phoneNumber', (user as any).phoneNumber || '');
      setValue('avatarUrl', (user as any).avatarUrl || '');
    }
  }, [user, setValue]);

  const onSaveProfile = async (data: ProfileData) => {
    setProfileError(null);
    setProfileMsg(null);
    try {
      const res = await api.put('/users/me', data);
      setAuth(res.data, token!);
      setProfileMsg('Profile updated successfully.');
    } catch (err: any) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  const onChangePassword = async (data: PasswordData) => {
    setPasswordError(null);
    setPasswordMsg(null);
    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setPasswordMsg('Password changed successfully.');
      resetPassword();
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Failed to change password.');
    }
  };

  const initials = (user as any)?.fullName
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <Box maxWidth={680} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>
        My Profile
      </Typography>

      {/* Avatar & Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
            <Avatar
              src={(user as any)?.avatarUrl}
              sx={{ width: 80, height: 80, fontSize: 28, bgcolor: 'primary.main' }}
            >
              {initials}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {(user as any)?.fullName || user?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
              <Typography variant="body2" color="primary.main" fontWeight={500}>
                {user?.role}
              </Typography>
            </Box>
          </Box>

          {profileMsg && <Alert severity="success" sx={{ mb: 2 }}>{profileMsg}</Alert>}
          {profileError && <Alert severity="error" sx={{ mb: 2 }}>{profileError}</Alert>}

          <Box component="form" onSubmit={handleProfileSubmit(onSaveProfile)}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Full Name"
                  error={!!profileErrors.fullName}
                  helperText={profileErrors.fullName?.message}
                  {...profileReg('fullName')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  {...profileReg('phoneNumber')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Avatar URL"
                  placeholder="https://..."
                  error={!!profileErrors.avatarUrl}
                  helperText={profileErrors.avatarUrl?.message}
                  {...profileReg('avatarUrl')}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isProfileSubmitting}
                  startIcon={isProfileSubmitting ? <CircularProgress size={16} color="inherit" /> : <Save />}
                >
                  Save Changes
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Lock color="action" />
            <Typography variant="h6" fontWeight={600}>
              Change Password
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {passwordMsg && <Alert severity="success" sx={{ mb: 2 }}>{passwordMsg}</Alert>}
          {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}

          <Box component="form" onSubmit={handlePasswordSubmit(onChangePassword)}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type="password"
                  error={!!passErrors.currentPassword}
                  helperText={passErrors.currentPassword?.message}
                  {...passReg('currentPassword')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="New Password"
                  type="password"
                  error={!!passErrors.newPassword}
                  helperText={
                    passErrors.newPassword?.message ||
                    'Min 8 chars, uppercase, lowercase, number, special char'
                  }
                  {...passReg('newPassword')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type="password"
                  error={!!passErrors.confirmPassword}
                  helperText={passErrors.confirmPassword?.message}
                  {...passReg('confirmPassword')}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="outlined"
                  color="warning"
                  disabled={isPassSubmitting}
                  startIcon={isPassSubmitting ? <CircularProgress size={16} color="inherit" /> : <Lock />}
                >
                  Change Password
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProfilePage;
