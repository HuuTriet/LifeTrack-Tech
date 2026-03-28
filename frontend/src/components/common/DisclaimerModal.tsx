import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ElderlyButton from './ElderlyButton';

interface DisclaimerModalProps {
  open: boolean;
  onAgree: () => void;
  onClose: () => void;
}

/**
 * Disclaimer modal for "Generic Reminder" mode.
 * Per business rules: Generic Reminder → ALL safety checks OFF
 * BUT must show this disclaimer and user must click "Tôi đồng ý" to proceed.
 */
const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ open, onAgree, onClose }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px', border: '2px solid #4A8FB8' } }}
    >
      <Box
        sx={{
          background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <InfoOutlinedIcon sx={{ color: 'white', fontSize: '2rem' }} />
        <DialogTitle sx={{ p: 0, color: 'white', fontSize: '1.4rem', fontWeight: 700 }}>
          Miễn trừ trách nhiệm
        </DialogTitle>
      </Box>

      <DialogContent sx={{ pt: 3 }}>
        <Typography
          variant="body1"
          sx={{ fontSize: '1.05rem', color: '#2C3E50', mb: 2, lineHeight: 1.7 }}
        >
          Bạn đang sử dụng chế độ <strong>"Nhắc nhở qua ảnh"</strong>. Ở chế độ này:
        </Typography>

        <List dense>
          {[
            'Ứng dụng sẽ nhắc uống thuốc dựa trên hình ảnh, KHÔNG kiểm tra tên thuốc hay hàm lượng.',
            'Mọi kiểm tra an toàn tự động (tương tác thuốc, quá liều) đều bị TẮT.',
            'Người dùng/người chăm sóc hoàn toàn chịu trách nhiệm về việc sử dụng thuốc đúng cách.',
            'LifeTrack Tech KHÔNG chịu trách nhiệm về bất kỳ tác dụng phụ nào phát sinh từ việc dùng thuốc theo chế độ này.',
          ].map((text, i) => (
            <ListItem key={i} sx={{ alignItems: 'flex-start', px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                <CheckCircleOutlineIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={text}
                primaryTypographyProps={{ fontSize: '0.95rem', color: '#2C3E50', lineHeight: 1.6 }}
              />
            </ListItem>
          ))}
        </List>

        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: '#FFF3CD',
            borderRadius: '12px',
            border: '1px solid #F4A261',
          }}
        >
          <Typography sx={{ fontSize: '0.95rem', color: '#7B4F00', fontWeight: 500 }}>
            ⚠️ Hãy tham khảo ý kiến bác sĩ hoặc dược sĩ trước khi dùng thuốc.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.5, gap: 2 }}>
        <ElderlyButton variant="outlined" onClick={onClose} color="inherit" fullWidth>
          Hủy bỏ
        </ElderlyButton>
        <ElderlyButton onClick={onAgree} color="primary" fullWidth>
          Tôi đồng ý — Tiếp tục
        </ElderlyButton>
      </DialogActions>
    </Dialog>
  );
};

export default DisclaimerModal;
