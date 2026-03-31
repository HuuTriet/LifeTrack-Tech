import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Dialog, DialogContent, Box, Typography, Button, Chip, Slide,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import MedicationIcon from '@mui/icons-material/Medication';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { medicationService } from '../../services/medicationService';
import { useAuthStore } from '../../store/authStore';

export interface AlarmMed {
  prescriptionItemId: string;
  drugName: string;
  scheduledTime: string;
  dosage?: number;
  dosageUnit?: string;
  mealRelation?: string;
  instructions?: string;
  overdue?: boolean;
}

const MEAL_LABELS: Record<string, string> = {
  BEFORE_MEAL: 'Trước bữa ăn',
  AFTER_MEAL:  'Sau bữa ăn',
  WITH_MEAL:   'Trong bữa ăn',
  BEFORE:      'Trước bữa ăn',
  AFTER:       'Sau bữa ăn',
  WITH:        'Trong bữa ăn',
  INDEPENDENT: 'Bất kỳ lúc nào',
};

const SlideUp = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface Props {
  alarm: AlarmMed | null;
  onDismiss: () => void;
  onTaken: (med: AlarmMed) => Promise<void> | void;
  onSnooze: (med: AlarmMed) => void;
}

const MedicationAlarmDialog: React.FC<Props> = ({ alarm, onDismiss, onTaken, onSnooze }) => {
  const [taking, setTaking] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(false);
    setTaking(false);
  }, [alarm?.prescriptionItemId]);

  if (!alarm) return null;

  const handleTaken = async () => {
    setTaking(true);
    await onTaken(alarm);
    setDone(true);
    setTimeout(onDismiss, 1200);
  };

  const dosageStr = alarm.dosage
    ? `${alarm.dosage} ${alarm.dosageUnit || 'mg'}`
    : '';

  return (
    <Dialog
      open={!!alarm}
      TransitionComponent={SlideUp}
      keepMounted={false}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          overflow: 'hidden',
          border: alarm.overdue
            ? '3px solid #E76F51'
            : '3px solid #4A8FB8',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Header */}
        <Box
          sx={{
            background: alarm.overdue
              ? 'linear-gradient(135deg, #E76F51 0%, #C0532A 100%)'
              : 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
            p: 3, textAlign: 'center', color: 'white',
          }}
        >
          <Box
            sx={{
              width: 72, height: 72, borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 1.5,
              animation: done ? 'none' : 'pulse 1.5s infinite',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(255,255,255,0.4)' },
                '70%': { transform: 'scale(1.05)', boxShadow: '0 0 0 12px rgba(255,255,255,0)' },
                '100%': { transform: 'scale(1)' },
              },
            }}
          >
            {alarm.overdue
              ? <WarningAmberIcon sx={{ fontSize: '2.5rem', color: 'white' }} />
              : <AccessAlarmIcon sx={{ fontSize: '2.5rem', color: 'white' }} />}
          </Box>

          <Typography sx={{ fontSize: '1rem', fontWeight: 600, opacity: 0.9, mb: 0.5 }}>
            {alarm.overdue ? '⚠️ Trễ giờ uống thuốc!' : '💊 Đến giờ uống thuốc!'}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.2 }}>
            {alarm.scheduledTime}
          </Typography>
        </Box>

        {/* Body */}
        <Box sx={{ p: 3 }}>
          {done ? (
            <Box textAlign="center" py={2}>
              <CheckCircleIcon sx={{ fontSize: '4rem', color: '#52B788', mb: 1 }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#52B788' }}>
                Đã ghi nhận! 🎉
              </Typography>
            </Box>
          ) : (
            <>
              {/* Drug info */}
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', gap: 2, mb: 3,
                  p: 2, bgcolor: '#F0F8FF', borderRadius: '14px',
                }}
              >
                <Box
                  sx={{
                    width: 52, height: 52, borderRadius: '14px',
                    bgcolor: '#2E5C7F15', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <MedicationIcon sx={{ fontSize: '1.8rem', color: '#2E5C7F' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#2C3E50' }}>
                    {alarm.drugName}
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                    {dosageStr && (
                      <Chip label={dosageStr} size="small" sx={{ fontWeight: 600, fontSize: '0.85rem' }} />
                    )}
                    {alarm.mealRelation && MEAL_LABELS[alarm.mealRelation] && (
                      <Chip
                        label={MEAL_LABELS[alarm.mealRelation]}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.85rem' }}
                      />
                    )}
                  </Box>
                  {alarm.instructions && (
                    <Typography sx={{ fontSize: '0.85rem', color: '#7A8B99', mt: 0.5 }}>
                      📋 {alarm.instructions}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Actions */}
              <Box display="flex" flexDirection="column" gap={1.5}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleTaken}
                  disabled={taking}
                  startIcon={<CheckCircleIcon />}
                  sx={{
                    py: 1.5, fontSize: '1.1rem', fontWeight: 700,
                    borderRadius: '14px', bgcolor: '#52B788',
                    '&:hover': { bgcolor: '#3d9a6a' },
                    boxShadow: '0 4px 15px rgba(82,183,136,0.4)',
                  }}
                >
                  {taking ? 'Đang ghi nhận...' : 'Đã uống thuốc ✓'}
                </Button>

                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => onSnooze(alarm)}
                    startIcon={<AccessAlarmIcon />}
                    sx={{ py: 1.2, borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600 }}
                  >
                    Nhắc lại 10 phút
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    fullWidth
                    onClick={onDismiss}
                    startIcon={<SkipNextIcon />}
                    sx={{ py: 1.2, borderRadius: '12px', fontSize: '0.95rem', color: '#7A8B99' }}
                  >
                    Bỏ qua
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// ── Hook: manages alarm queue ─────────────────────────────────────────────────

export function useMedicationAlarm() {
  const getElderlyId = useAuthStore((s) => s.getElderlyId);
  const [queue, setQueue] = useState<AlarmMed[]>([]);
  const [current, setCurrent] = useState<AlarmMed | null>(null);
  const snoozeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Process queue
  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrent(next);
      setQueue(rest);
    }
  }, [current, queue]);

  const pushAlarm = useCallback((med: AlarmMed) => {
    setQueue(q => {
      // Deduplicate
      const exists = q.some(m => m.prescriptionItemId === med.prescriptionItemId && m.scheduledTime === med.scheduledTime);
      if (exists) return q;
      return [...q, med];
    });
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);

  const handleTaken = useCallback(async (med: AlarmMed) => {
    const elderlyId = getElderlyId();
    if (!elderlyId) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      await medicationService.markTaken(
        med.prescriptionItemId, elderlyId, med.drugName, today, med.scheduledTime,
      );
    } catch { /* ignore */ }
  }, [getElderlyId]);

  const handleSnooze = useCallback((med: AlarmMed) => {
    dismiss();
    const key = `${med.prescriptionItemId}-${med.scheduledTime}`;
    if (snoozeTimers.current[key]) clearTimeout(snoozeTimers.current[key]);
    snoozeTimers.current[key] = setTimeout(() => {
      pushAlarm(med);
    }, 10 * 60 * 1000);
  }, [dismiss, pushAlarm]);

  return { current, pushAlarm, dismiss, handleTaken, handleSnooze };
}

export default MedicationAlarmDialog;
