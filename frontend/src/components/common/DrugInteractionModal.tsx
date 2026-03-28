import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Alert,
  Chip,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ElderlyButton from './ElderlyButton';
import type { DrugInteractionResult } from '../../types';

interface DrugInteractionModalProps {
  open: boolean;
  interaction: DrugInteractionResult | null;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLoading?: boolean;
}

/**
 * HIGH RISK drug interaction warning modal.
 * Shows a RED alert modal requiring special confirmation.
 * Per business rules: High Risk → must show this modal with Cancel as primary action.
 */
const DrugInteractionModal: React.FC<DrugInteractionModalProps> = ({
  open,
  interaction,
  onCancel,
  onConfirm,
  confirmLoading = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          border: '3px solid #E76F51',
          overflow: 'hidden',
        },
      }}
    >
      {/* Red header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #E76F51 0%, #C0392B 100%)',
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <WarningAmberIcon sx={{ color: 'white', fontSize: '2rem' }} />
        <DialogTitle
          sx={{
            p: 0,
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: 700,
          }}
        >
          ⚠️ Cảnh báo: Tương tác thuốc nguy hiểm!
        </DialogTitle>
      </Box>

      <DialogContent sx={{ pt: 3, pb: 1 }}>
        <Alert severity="error" sx={{ mb: 2, fontSize: '1rem', borderRadius: '12px' }}>
          {interaction?.message ||
            'Thuốc này có tương tác nguy hiểm với các thuốc hiện tại của bệnh nhân.'}
        </Alert>

        {interaction?.conflictingDrugs && interaction.conflictingDrugs.length > 0 && (
          <Box mb={2}>
            <Typography
              variant="body1"
              sx={{ fontWeight: 600, mb: 1, fontSize: '1.05rem', color: '#2C3E50' }}
            >
              Thuốc xung đột:
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {interaction.conflictingDrugs.map((drug) => (
                <Chip
                  key={drug}
                  label={drug}
                  color="error"
                  variant="outlined"
                  sx={{ fontWeight: 600, fontSize: '0.95rem' }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Alert severity="warning" sx={{ borderRadius: '12px', fontSize: '0.95rem' }}>
          Nếu vẫn muốn thêm thuốc này, vui lòng tham khảo ý kiến bác sĩ trước. Bạn chịu
          hoàn toàn trách nhiệm nếu tiếp tục.
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.5, gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        {/* Cancel is the PRIMARY (safe) action */}
        <ElderlyButton
          onClick={onCancel}
          color="error"
          variant="contained"
          fullWidth
          sx={{ bgcolor: '#E76F51', '&:hover': { bgcolor: '#C0392B' } }}
        >
          Hủy bỏ — Không thêm thuốc
        </ElderlyButton>

        {/* Confirm is secondary — smaller, less prominent */}
        <ElderlyButton
          onClick={onConfirm}
          loading={confirmLoading}
          variant="outlined"
          color="warning"
          fullWidth
          sx={{ borderColor: '#F4A261', color: '#F4A261' }}
        >
          Tôi hiểu rủi ro, vẫn lưu
        </ElderlyButton>
      </DialogActions>
    </Dialog>
  );
};

export default DrugInteractionModal;
