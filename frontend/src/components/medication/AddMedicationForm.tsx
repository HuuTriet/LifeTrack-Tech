import React, { useState, useRef } from 'react';
import {
  Box,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Grid,
  Chip,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ElderlyButton from '../common/ElderlyButton';
import DrugInteractionModal from '../common/DrugInteractionModal';
import DisclaimerModal from '../common/DisclaimerModal';
import { medicationService } from '../../services/medicationService';
import type { AddMedicationFormData, DrugInteractionResult, OcrResult } from '../../types';

// ============================================================
// VALIDATION SCHEMA
// ============================================================
const schema = z
  .object({
    drugName: z.string().min(1, 'Tên thuốc là bắt buộc'),
    dosage: z.string(),
    frequency: z.string().min(1, 'Tần suất là bắt buộc'),
    time: z.string().min(1, 'Giờ uống là bắt buộc'),
    notes: z.string().optional(),
    isUnknownDosage: z.boolean(),
    isGenericReminder: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // Generic Reminder: drug name not required
    if (!data.isGenericReminder && !data.drugName) {
      ctx.addIssue({ code: 'custom', path: ['drugName'], message: 'Tên thuốc là bắt buộc' });
    }
    // If not unknown dosage and not generic reminder: dosage required
    if (!data.isUnknownDosage && !data.isGenericReminder && !data.dosage) {
      ctx.addIssue({ code: 'custom', path: ['dosage'], message: 'Hàm lượng là bắt buộc' });
    }
  });

type FormValues = z.infer<typeof schema>;

interface AddMedicationFormProps {
  existingDrugs?: string[];
  onSuccess?: (data: AddMedicationFormData) => void;
}

// ============================================================
// COMPONENT
// ============================================================
const AddMedicationForm: React.FC<AddMedicationFormProps> = ({
  existingDrugs = [],
  onSuccess,
}) => {
  // --- OCR state ---
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [reminderImagePreview, setReminderImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reminderImageRef = useRef<HTMLInputElement>(null);

  // --- Interaction state ---
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionResult, setInteractionResult] = useState<DrugInteractionResult | null>(null);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // --- Disclaimer state (Generic Reminder) ---
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // --- Submit state ---
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      drugName: '',
      dosage: '',
      frequency: '',
      time: '',
      notes: '',
      isUnknownDosage: false,
      isGenericReminder: false,
    },
  });

  const isUnknownDosage = watch('isUnknownDosage');
  const isGenericReminder = watch('isGenericReminder');
  const drugName = watch('drugName');

  // ============================================================
  // OCR — Scan prescription image
  // ============================================================
  const handleOcrScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);

    try {
      const result = await medicationService.scanOcr(file);
      setOcrResult(result);

      // Auto-fill form fields from OCR
      if (result.drugName) setValue('drugName', result.drugName);
      if (result.frequency) setValue('frequency', result.frequency);

      // Case 1: OCR missing dosage → highlight dosage field (handled via ocrResult state)
      if (result.drugName && !result.dosage) {
        setOcrError('OCR không nhận được hàm lượng thuốc. Vui lòng nhập tay.');
      } else if (result.dosage) {
        setValue('dosage', result.dosage);
      }
    } catch {
      setOcrError('Không thể đọc hình ảnh. Vui lòng thử lại hoặc nhập tay.');
    } finally {
      setOcrLoading(false);
      // Reset input to allow same file re-upload
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ============================================================
  // Generic Reminder — upload pill image
  // ============================================================
  const handleReminderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setReminderImagePreview(url);
  };

  // ============================================================
  // Generic Reminder checkbox toggle
  // ============================================================
  const handleGenericReminderChange = (checked: boolean) => {
    setValue('isGenericReminder', checked);
    if (checked && !disclaimerAccepted) {
      setShowDisclaimer(true);
    }
    if (!checked) {
      setDisclaimerAccepted(false);
      setReminderImagePreview(null);
    }
  };

  // ============================================================
  // Submit — drug interaction check → modal → save
  // ============================================================
  const onSubmit = async (values: FormValues) => {
    // Generic Reminder: must accept disclaimer first
    if (values.isGenericReminder && !disclaimerAccepted) {
      setShowDisclaimer(true);
      return;
    }

    const payload: AddMedicationFormData = {
      ...values,
      reminderImageUrl: reminderImagePreview || undefined,
    };

    // Skip interaction check for generic reminder (safety checks OFF)
    if (!values.isGenericReminder && values.drugName) {
      setInteractionLoading(true);
      try {
        const result = await medicationService.checkInteraction(values.drugName, existingDrugs);
        setInteractionResult(result);

        if (result.risk === 'high') {
          setInteractionLoading(false);
          setShowInteractionModal(true);
          return; // Pause, wait for modal decision
        }
      } catch {
        // Non-blocking — proceed if check fails
      } finally {
        setInteractionLoading(false);
      }
    }

    await saveMedication(payload);
  };

  const saveMedication = async (payload: AddMedicationFormData) => {
    setSubmitLoading(true);
    try {
      await medicationService.create(payload);
      setSubmitSuccess(true);
      onSuccess?.(payload);
    } catch {
      // Handle error
    } finally {
      setSubmitLoading(false);
    }
  };

  // User confirms despite high-risk interaction
  const handleInteractionConfirm = async () => {
    setConfirmLoading(true);
    setShowInteractionModal(false);
    const values = watch() as FormValues;
    await saveMedication({ ...values, reminderImageUrl: reminderImagePreview || undefined });
    setConfirmLoading(false);
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (submitSuccess) {
    return (
      <Box textAlign="center" py={6}>
        <CheckCircleIcon sx={{ fontSize: '5rem', color: '#52B788', mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#2E5C7F', mb: 1 }}>
          Đã thêm thuốc thành công!
        </Typography>
        <Typography color="text.secondary" mb={4}>
          Thuốc đã được thêm vào lịch uống.
        </Typography>
        <ElderlyButton onClick={() => setSubmitSuccess(false)} color="primary">
          Thêm thuốc khác
        </ElderlyButton>
      </Box>
    );
  }

  return (
    <>
      {/* ---- Drug Interaction Modal (HIGH RISK) ---- */}
      <DrugInteractionModal
        open={showInteractionModal}
        interaction={interactionResult}
        onCancel={() => setShowInteractionModal(false)}
        onConfirm={handleInteractionConfirm}
        confirmLoading={confirmLoading}
      />

      {/* ---- Disclaimer Modal (Generic Reminder) ---- */}
      <DisclaimerModal
        open={showDisclaimer}
        onAgree={() => {
          setDisclaimerAccepted(true);
          setShowDisclaimer(false);
        }}
        onClose={() => {
          setValue('isGenericReminder', false);
          setShowDisclaimer(false);
        }}
      />

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* ---- OCR Scanner Section ---- */}
        <Paper
          variant="outlined"
          sx={{ p: 3, mb: 3, borderRadius: '16px', borderStyle: 'dashed', borderColor: '#4A8FB8' }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#2E5C7F', mb: 1 }}>
            📷 Quét đơn thuốc (OCR)
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Chụp/tải ảnh đơn thuốc để tự động điền thông tin.
          </Typography>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleOcrScan}
          />
          <ElderlyButton
            type="button"
            variant="outlined"
            color="primary"
            icon={ocrLoading ? undefined : <CameraAltIcon />}
            loading={ocrLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {ocrLoading ? 'Đang quét...' : 'Chọn ảnh đơn thuốc'}
          </ElderlyButton>

          {/* OCR result chips */}
          {ocrResult && !ocrError && (
            <Box mt={2} display="flex" gap={1} flexWrap="wrap">
              <Chip label="OCR thành công ✓" color="success" size="small" />
              {ocrResult.dosage && (
                <Chip label={`Hàm lượng: ${ocrResult.dosage}`} color="primary" size="small" />
              )}
            </Box>
          )}

          {/* Case 1: OCR missing dosage */}
          {ocrError && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: '10px' }}>
              {ocrError}
            </Alert>
          )}
        </Paper>

        {/* ---- Mode Checkboxes ---- */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: '16px' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2E5C7F', mb: 1.5 }}>
            Tùy chọn đặc biệt
          </Typography>

          {/* Case 2: Unknown Dosage */}
          <Controller
            name="isUnknownDosage"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={field.value}
                    disabled={isGenericReminder}
                    size="medium"
                    sx={{ '& .MuiSvgIcon-root': { fontSize: '1.5rem' } }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: '1rem', fontWeight: 500 }}>
                    Hàm lượng không xác định (Unknown Dosage)
                  </Typography>
                }
              />
            )}
          />

          <Divider sx={{ my: 1 }} />

          {/* Case 3: Generic Reminder */}
          <FormControlLabel
            control={
              <Checkbox
                checked={isGenericReminder}
                onChange={(e) => handleGenericReminderChange(e.target.checked)}
                size="medium"
                sx={{ '& .MuiSvgIcon-root': { fontSize: '1.5rem' } }}
              />
            }
            label={
              <Typography sx={{ fontSize: '1rem', fontWeight: 500 }}>
                Chỉ nhắc qua ảnh (Generic Reminder)
                {disclaimerAccepted && (
                  <Chip label="Đã đồng ý" color="warning" size="small" sx={{ ml: 1 }} />
                )}
              </Typography>
            }
          />
        </Paper>

        {/* ---- Generic Reminder: Upload pill image ---- */}
        {isGenericReminder && disclaimerAccepted && (
          <Paper
            variant="outlined"
            sx={{ p: 3, mb: 3, borderRadius: '16px', borderColor: '#F4A261' }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#E88D5D', mb: 1 }}>
              📸 Ảnh viên thuốc
            </Typography>
            <input
              ref={reminderImageRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleReminderImageUpload}
            />
            <ElderlyButton
              type="button"
              variant="outlined"
              color="warning"
              icon={<UploadFileIcon />}
              onClick={() => reminderImageRef.current?.click()}
            >
              Tải ảnh viên thuốc
            </ElderlyButton>
            {reminderImagePreview && (
              <Box mt={2}>
                <img
                  src={reminderImagePreview}
                  alt="Viên thuốc"
                  style={{ maxWidth: 200, borderRadius: 12, border: '2px solid #F4A261' }}
                />
              </Box>
            )}
          </Paper>
        )}

        {/* ---- Main Form Fields ---- */}
        <Grid container spacing={3}>
          {/* Drug Name — hidden in Generic Reminder mode */}
          {!isGenericReminder && (
            <Grid item xs={12} md={6}>
              <Controller
                name="drugName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Tên thuốc *"
                    fullWidth
                    error={!!errors.drugName}
                    helperText={errors.drugName?.message}
                    InputProps={{ style: { fontSize: '1rem' } }}
                    InputLabelProps={{ style: { fontSize: '1rem' } }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                )}
              />
            </Grid>
          )}

          {/* Dosage — disabled if Unknown Dosage or Generic Reminder */}
          {!isGenericReminder && (
            <Grid item xs={12} md={6}>
              <Controller
                name="dosage"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={isUnknownDosage ? 'Hàm lượng (Không xác định)' : 'Hàm lượng *'}
                    fullWidth
                    disabled={isUnknownDosage}
                    // Case 1: OCR missing dosage → red highlight
                    error={!!errors.dosage || (!!ocrResult && !ocrResult.dosage && !isUnknownDosage)}
                    helperText={
                      errors.dosage?.message ||
                      (ocrResult && !ocrResult.dosage && !isUnknownDosage
                        ? '⚠️ OCR không nhận được hàm lượng — vui lòng nhập tay'
                        : undefined)
                    }
                    InputProps={{ style: { fontSize: '1rem' } }}
                    InputLabelProps={{ style: { fontSize: '1rem' } }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                )}
              />
            </Grid>
          )}

          <Grid item xs={12} md={6}>
            <Controller
              name="frequency"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Tần suất *"
                  fullWidth
                  placeholder="VD: 2 lần/ngày, sau bữa ăn"
                  error={!!errors.frequency}
                  helperText={errors.frequency?.message}
                  InputProps={{ style: { fontSize: '1rem' } }}
                  InputLabelProps={{ style: { fontSize: '1rem' } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Controller
              name="time"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Giờ uống *"
                  type="time"
                  fullWidth
                  error={!!errors.time}
                  helperText={errors.time?.message}
                  InputLabelProps={{ shrink: true, style: { fontSize: '1rem' } }}
                  InputProps={{ style: { fontSize: '1rem' } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Ghi chú"
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="VD: Uống với nhiều nước, tránh ánh nắng..."
                  InputProps={{ style: { fontSize: '1rem' } }}
                  InputLabelProps={{ style: { fontSize: '1rem' } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              )}
            />
          </Grid>
        </Grid>

        {/* ---- Submit ---- */}
        <Box mt={4}>
          <ElderlyButton
            type="submit"
            color="primary"
            loading={submitLoading || interactionLoading}
            fullWidth
          >
            {interactionLoading
              ? 'Đang kiểm tra tương tác thuốc...'
              : submitLoading
              ? 'Đang lưu...'
              : '💊 Thêm thuốc'}
          </ElderlyButton>
        </Box>
      </Box>
    </>
  );
};

export default AddMedicationForm;
