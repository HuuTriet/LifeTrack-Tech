import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AddMedicationForm from '../../components/medication/AddMedicationForm';
import type { AddMedicationFormData } from '../../types';
import { medicationService } from '../../services/medicationService';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

interface ElderlyOption {
  id: string;       // ElderlyProfile ID (used as elderlyId for API calls)
  label: string;    // Display name
}

/**
 * AddMedicationPage
 *
 * Caregiver flow:
 *  1. Load the list of elderly patients assigned to this caregiver.
 *  2. Let the caregiver pick which patient to prescribe for (or use
 *     the already-selected patient from the auth store).
 *  3. On form submit, call the real backend prescription API with
 *     the correct payload shape (CreatePrescriptionPayload).
 *  4. On success, navigate to the caregiver dashboard.
 */
const AddMedicationPage: React.FC = () => {
  const navigate = useNavigate();
  const { getElderlyId, selectElderly } = useAuthStore();

  const [elderlyOptions, setElderlyOptions] = useState<ElderlyOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>(getElderlyId() ?? '');
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load the caregiver's assigned elderly patients
  useEffect(() => {
    const fetchPatients = async () => {
      setLoadingPatients(true);
      setPatientsError(null);
      try {
        const res = await api.get('/elderly');
        const profiles: any[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
        const opts: ElderlyOption[] = profiles.map((p) => ({
          id: p.id,
          label: p.user?.fullName || p.user?.name || `Patient #${p.id.slice(0, 8)}`,
        }));
        setElderlyOptions(opts);

        // Pre-select: use store value if valid, otherwise first in list
        const storeId = getElderlyId();
        if (storeId && opts.some((o) => o.id === storeId)) {
          setSelectedId(storeId);
        } else if (opts.length > 0) {
          setSelectedId(opts[0].id);
          selectElderly(opts[0].id);
        }
      } catch {
        // Fallback: try to use existing store value
        const storeId = getElderlyId();
        if (storeId) {
          setElderlyOptions([{ id: storeId, label: 'Current Patient' }]);
          setSelectedId(storeId);
        } else {
          setPatientsError('Could not load patient list. Please select a patient manually.');
        }
      } finally {
        setLoadingPatients(false);
      }
    };
    fetchPatients();
  }, []);

  const handlePatientChange = (newId: string) => {
    setSelectedId(newId);
    selectElderly(newId);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleSuccess = async (data: AddMedicationFormData) => {
    if (!selectedId) {
      setSubmitError('Please select a patient before saving.');
      return;
    }
    setSubmitError(null);

    try {
      await medicationService.createFromFormData(selectedId, data);
      setSubmitSuccess(true);
    } catch (err: any) {
      const apiError = err?.response?.data;

      if (apiError?.statusCode === 422) {
        // Backend validation: dosage missing — the form handles this inline
        setSubmitError(
          `Dosage required: ${apiError.message || 'Please enter a dosage or check "Unknown Dosage".'}`,
        );
      } else if (apiError?.statusCode === 400 && apiError?.interactions) {
        // HIGH RISK drug interaction — details are shown in the DrugInteractionModal,
        // but we surface the top-level message here as a fallback.
        setSubmitError(
          `Drug interaction alert: ${apiError.message || 'HIGH RISK interaction detected.'}`,
        );
      } else {
        setSubmitError(
          apiError?.message || 'Failed to save prescription. Please try again.',
        );
      }
    }
  };

  if (submitSuccess) {
    return (
      <Box maxWidth={720} mx="auto" textAlign="center" py={6}>
        <Typography variant="h5" fontWeight={700} color="success.main" mb={1}>
          Prescription saved successfully!
        </Typography>
        <Typography color="text.secondary" mb={4}>
          The medication has been added to the patient's schedule and reminders have been set.
        </Typography>
        <Box display="flex" gap={2} justifyContent="center">
          <Button variant="contained" onClick={() => setSubmitSuccess(false)}>
            Add Another Medication
          </Button>
          <Button variant="outlined" onClick={() => navigate('/caregiver/dashboard')}>
            Back to Dashboard
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box maxWidth={720} mx="auto">
      <Typography variant="h4" sx={{ fontWeight: 700, color: '#2E5C7F', mb: 1 }}>
        Thêm thuốc mới
      </Typography>
      <Typography color="text.secondary" mb={4}>
        Điền thông tin thuốc hoặc quét đơn thuốc bằng OCR.
      </Typography>

      {/* Patient selector */}
      {loadingPatients ? (
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading patient list...</Typography>
        </Box>
      ) : (
        <Box mb={3}>
          <FormControl fullWidth>
            <InputLabel>Patient</InputLabel>
            <Select
              value={selectedId}
              label="Patient"
              onChange={(e) => handlePatientChange(e.target.value as string)}
            >
              {elderlyOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label}
                </MenuItem>
              ))}
              {elderlyOptions.length === 0 && (
                <MenuItem disabled value="">
                  No patients found
                </MenuItem>
              )}
            </Select>
          </FormControl>
          {patientsError && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {patientsError}
            </Alert>
          )}
        </Box>
      )}

      {submitError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {!loadingPatients && selectedId && (
        <AddMedicationForm
          existingDrugs={[]}
          onSuccess={handleSuccess}
        />
      )}

      {!loadingPatients && !selectedId && (
        <Alert severity="info">
          Please select a patient above to continue.
        </Alert>
      )}
    </Box>
  );
};

export default AddMedicationPage;
