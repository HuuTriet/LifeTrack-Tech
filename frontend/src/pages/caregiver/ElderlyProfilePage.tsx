import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import {
  Add,
  Edit,
  Archive,
  Person,
  LocalHospital,
  ContactPhone,
} from '@mui/icons-material';
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
  user?: { fullName: string; email: string };
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];

const ElderlyProfilePage: React.FC = () => {
  const [profiles, setProfiles] = useState<ElderlyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } =
    useForm<Partial<ElderlyProfile> & { userId: string }>();

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/elderly');
      setProfiles(res.data);
    } catch {
      setError('Failed to load elderly profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const openCreate = () => {
    reset();
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (profile: ElderlyProfile) => {
    setEditingId(profile.id);
    Object.entries(profile).forEach(([k, v]) =>
      setValue(k as any, v as any),
    );
    setDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    setError(null);
    try {
      if (editingId) {
        await api.put(`/elderly/${editingId}`, data);
        setSuccessMsg('Profile updated successfully.');
      } else {
        await api.post('/elderly', data);
        setSuccessMsg('Elderly profile created successfully.');
      }
      setDialogOpen(false);
      fetchProfiles();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save profile.');
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm('Archive this elderly profile?')) return;
    try {
      await api.delete(`/elderly/${id}`);
      setSuccessMsg('Profile archived successfully.');
      fetchProfiles();
    } catch {
      setError('Failed to archive profile.');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Elderly Profiles</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage patient medical profiles (UC-05)
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Patient
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ my: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ my: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Person sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No elderly profiles yet</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ mt: 2 }}>
              Add First Patient
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2} mt={1}>
          {profiles.map((p) => (
            <Grid item xs={12} md={6} key={p.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Person color="primary" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        {p.user?.fullName || 'Unknown'}
                      </Typography>
                    </Box>
                    <Box>
                      {p.bloodType && (
                        <Chip label={p.bloodType} size="small" color="error" variant="outlined" sx={{ mr: 1 }} />
                      )}
                      <IconButton size="small" onClick={() => openEdit(p)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="warning" onClick={() => handleArchive(p.id)}>
                        <Archive fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {p.user?.email}
                  </Typography>

                  <Grid container spacing={1}>
                    {p.dateOfBirth && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">DOB</Typography>
                        <Typography variant="body2">{new Date(p.dateOfBirth).toLocaleDateString()}</Typography>
                      </Grid>
                    )}
                    {p.gender && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Gender</Typography>
                        <Typography variant="body2" textTransform="capitalize">{p.gender}</Typography>
                      </Grid>
                    )}
                    {p.weight && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Weight</Typography>
                        <Typography variant="body2">{p.weight} kg</Typography>
                      </Grid>
                    )}
                    {p.height && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Height</Typography>
                        <Typography variant="body2">{p.height} cm</Typography>
                      </Grid>
                    )}
                  </Grid>

                  {p.chronicConditions && (
                    <Box mt={1}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <LocalHospital fontSize="small" color="warning" />
                        <Typography variant="caption" fontWeight={600} color="warning.main">
                          Conditions
                        </Typography>
                      </Box>
                      <Typography variant="body2">{p.chronicConditions}</Typography>
                    </Box>
                  )}

                  {p.emergencyContactName && (
                    <Box mt={1}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <ContactPhone fontSize="small" color="error" />
                        <Typography variant="caption" fontWeight={600} color="error.main">
                          Emergency
                        </Typography>
                      </Box>
                      <Typography variant="body2">
                        {p.emergencyContactName} · {p.emergencyContactPhone}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Elderly Profile' : 'Add Elderly Patient'}</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ pt: 1 }}>
            {!editingId && (
              <TextField
                fullWidth
                label="User ID"
                required
                helperText="UUID of the user account to link"
                sx={{ mb: 2 }}
                {...register('userId')}
              />
            )}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth label="Date of Birth" type="date" InputLabelProps={{ shrink: true }} {...register('dateOfBirth')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Gender" defaultValue="" {...register('gender')}>
                  <MenuItem value="">Not specified</MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Weight (kg)" type="number" {...register('weight')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Height (cm)" type="number" {...register('height')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth select label="Blood Type" defaultValue="UNKNOWN" {...register('bloodType')}>
                  {BLOOD_TYPES.map((bt) => (
                    <MenuItem key={bt} value={bt}>{bt}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Room Number" {...register('roomNumber')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Known Allergies" multiline rows={2} placeholder="e.g. Penicillin, Shellfish" {...register('knownAllergies')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Chronic Conditions" multiline rows={2} placeholder="e.g. Hypertension, Type 2 Diabetes" {...register('chronicConditions')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Emergency Contact Name" {...register('emergencyContactName')} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Emergency Contact Phone" {...register('emergencyContactPhone')} />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : (editingId ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ElderlyProfilePage;
