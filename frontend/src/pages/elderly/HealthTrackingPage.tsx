import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Slider,
  Chip,
} from '@mui/material';
import {
  Favorite,
  MonitorHeart,
  Air,
  Thermostat,
  SentimentVerySatisfied,
  CheckCircle,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const schema = z.object({
  bloodPressureSystolic: z.coerce
    .number()
    .min(60)
    .max(300)
    .optional()
    .or(z.literal('')),
  bloodPressureDiastolic: z.coerce
    .number()
    .min(40)
    .max(200)
    .optional()
    .or(z.literal('')),
  heartRate: z.coerce.number().min(30).max(250).optional().or(z.literal('')),
  temperature: z.coerce.number().min(30).max(45).optional().or(z.literal('')),
  spo2: z.coerce.number().min(70).max(100).optional().or(z.literal('')),
  bloodSugar: z.coerce.number().min(1).max(35).optional().or(z.literal('')),
  moodScore: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  elderlyId?: string;
}

const MOOD_LABELS = ['', 'Very Bad', 'Bad', 'Poor', 'Below Average', 'Average',
  'Good', 'Very Good', 'Great', 'Excellent', 'Perfect'];

const HealthTrackingPage: React.FC<Props> = ({ elderlyId: elderlyIdProp }) => {
  const getElderlyId = useAuthStore((s) => s.getElderlyId);
  const elderlyId = elderlyIdProp || getElderlyId() || '';
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ status?: string; message?: string } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { moodScore: 7 },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setResult(null);
    try {
      const payload: Record<string, any> = {};
      if (data.bloodPressureSystolic !== '') payload.bloodPressureSystolic = Number(data.bloodPressureSystolic);
      if (data.bloodPressureDiastolic !== '') payload.bloodPressureDiastolic = Number(data.bloodPressureDiastolic);
      if (data.heartRate !== '') payload.heartRate = Number(data.heartRate);
      if (data.temperature !== '') payload.temperature = Number(data.temperature);
      if (data.spo2 !== '') payload.spo2 = Number(data.spo2);
      if (data.bloodSugar !== '') payload.bloodSugar = Number(data.bloodSugar);
      if (data.moodScore) payload.moodScore = data.moodScore;
      if (data.notes) payload.notes = data.notes;

      const res = await api.post(`/health/elderly/${elderlyId}/vitals`, payload);
      setResult({ status: res.data.status, message: 'Health check-in recorded successfully!' });
      reset({ moodScore: 7 });
    } catch (err: any) {
      setResult({ message: err.response?.data?.message || 'Failed to save health data.' });
    } finally {
      setSubmitting(false);
    }
  };

  const isSuccess = result?.message?.includes('successfully');

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={1}>
        Daily Health Check-in
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Record your vital signs to track your health (UC-06)
      </Typography>

      {result && (
        <Alert
          severity={isSuccess ? 'success' : 'error'}
          icon={isSuccess ? <CheckCircle /> : undefined}
          sx={{ mb: 2 }}
        >
          {result.message}
          {result.status && result.status !== 'NORMAL' && (
            <Chip
              label={result.status}
              color={result.status === 'CRITICAL' ? 'error' : 'warning'}
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* Blood Pressure */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MonitorHeart color="error" />
                  <Typography variant="h6" fontWeight={600}>
                    Blood Pressure
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Systolic (mmHg)"
                      type="number"
                      placeholder="e.g. 120"
                      error={!!errors.bloodPressureSystolic}
                      helperText={errors.bloodPressureSystolic?.message as string}
                      {...register('bloodPressureSystolic')}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Diastolic (mmHg)"
                      type="number"
                      placeholder="e.g. 80"
                      error={!!errors.bloodPressureDiastolic}
                      helperText={errors.bloodPressureDiastolic?.message as string}
                      {...register('bloodPressureDiastolic')}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Heart Rate & SpO2 */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Favorite color="error" />
                  <Typography variant="h6" fontWeight={600}>Heart Rate</Typography>
                </Box>
                <TextField
                  fullWidth
                  label="Heart Rate (bpm)"
                  type="number"
                  placeholder="e.g. 72"
                  error={!!errors.heartRate}
                  helperText={errors.heartRate?.message as string}
                  {...register('heartRate')}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Air color="primary" />
                  <Typography variant="h6" fontWeight={600}>Blood Oxygen (SpO₂)</Typography>
                </Box>
                <TextField
                  fullWidth
                  label="SpO₂ (%)"
                  type="number"
                  placeholder="e.g. 98"
                  error={!!errors.spo2}
                  helperText={errors.spo2?.message as string}
                  {...register('spo2')}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Temperature & Blood Sugar */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Thermostat color="warning" />
                  <Typography variant="h6" fontWeight={600}>Temperature</Typography>
                </Box>
                <TextField
                  fullWidth
                  label="Temperature (°C)"
                  type="number"
                  placeholder="e.g. 36.6"
                  inputProps={{ step: 0.1 }}
                  error={!!errors.temperature}
                  helperText={errors.temperature?.message as string}
                  {...register('temperature')}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={2}>
                  Blood Sugar
                </Typography>
                <TextField
                  fullWidth
                  label="Blood Sugar (mmol/L)"
                  type="number"
                  placeholder="e.g. 5.5"
                  inputProps={{ step: 0.1 }}
                  error={!!errors.bloodSugar}
                  helperText={errors.bloodSugar?.message as string}
                  {...register('bloodSugar')}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Mood */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <SentimentVerySatisfied color="success" />
                  <Typography variant="h6" fontWeight={600}>Mood Score</Typography>
                </Box>
                <Controller
                  name="moodScore"
                  control={control}
                  render={({ field }) => (
                    <Box sx={{ px: 2 }}>
                      <Slider
                        {...field}
                        min={1}
                        max={10}
                        step={1}
                        marks
                        valueLabelDisplay="on"
                        color="success"
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Very Bad</Typography>
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          {MOOD_LABELS[field.value ?? 7]}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Perfect</Typography>
                      </Box>
                    </Box>
                  )}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Additional Notes (optional)"
              multiline
              rows={2}
              placeholder="Any symptoms, concerns, or observations..."
              {...register('notes')}
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              sx={{ minWidth: 200, py: 1.5 }}
            >
              {submitting ? <CircularProgress size={24} color="inherit" /> : 'Save Check-in'}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default HealthTrackingPage;
