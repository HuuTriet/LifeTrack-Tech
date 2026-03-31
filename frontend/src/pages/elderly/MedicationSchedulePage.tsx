import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Grid, Chip, CircularProgress, Alert,
  LinearProgress, IconButton, Switch, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Paper, Avatar, Divider, Autocomplete,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import MedicationIcon from '@mui/icons-material/Medication';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import * as XLSX from 'xlsx';
import { medicationService } from '../../services/medicationService';
import {
  requestNotificationPermission, getNotificationPermission,
  startMedicationReminders, stopMedicationReminders, playAlertSound,
  type PendingMed,
} from '../../services/notificationService';
import { useAuthStore } from '../../store/authStore';
import { useAiChat } from '../../contexts/AiChatContext';

interface ScheduleItem extends PendingMed {
  dosageUnit?: string;
  mealRelation?: string;
  instructions?: string;
}

const MEAL_LABELS: Record<string, string> = {
  BEFORE_MEAL: 'Trước bữa ăn', AFTER_MEAL: 'Sau bữa ăn',
  WITH_MEAL: 'Trong bữa ăn', BEFORE: 'Trước ăn', AFTER: 'Sau ăn',
  WITH: 'Khi ăn', INDEPENDENT: 'Bất kỳ lúc nào',
};

const MEAL_OPTIONS = [
  { value: 'BEFORE_MEAL', label: 'Trước bữa ăn' },
  { value: 'WITH_MEAL', label: 'Trong bữa ăn' },
  { value: 'AFTER_MEAL', label: 'Sau bữa ăn' },
  { value: 'INDEPENDENT', label: 'Bất kỳ lúc nào' },
];

function getCurrentTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isOverdue(time: string, status: string) {
  if (status !== 'PENDING') return false;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m < getCurrentTimeMinutes();
}

interface MedItem { drugName: string; dosage: string; dosageUnit: string; scheduledTimes: string[]; mealRelation: string; instructions: string; }
const EMPTY_ITEM: MedItem = { drugName: '', dosage: '', dosageUnit: 'mg', scheduledTimes: ['08:00'], mealRelation: 'AFTER_MEAL', instructions: '' };

const MedicationSchedulePage: React.FC = () => {
  const { openChat } = useAiChat();
  const getElderlyId = useAuthStore((s) => s.getElderlyId);
  const elderlyId = getElderlyId() ?? '';

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const [now, setNow] = useState(new Date());
  const [showDone, setShowDone] = useState(true);

  // Add medication dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addItems, setAddItems] = useState<MedItem[]>([{ ...EMPTY_ITEM }]);
  const [addEndDate, setAddEndDate] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Excel import state
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [xlsxRows, setXlsxRows] = useState<any[]>([]);
  const [xlsxDialogOpen, setXlsxDialogOpen] = useState(false);
  const [xlsxImporting, setXlsxImporting] = useState(false);

  // Drug search autocomplete per item
  const [drugOptions, setDrugOptions] = useState<Array<{ id: string; label: string; strength?: string }[]>>(
    [[]],
  );
  const [drugSearching, setDrugSearching] = useState<boolean[]>([false]);
  const searchTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    if (!elderlyId) { setError('Không tìm thấy hồ sơ. Vui lòng đăng nhập lại.'); setLoading(false); return; }
    try {
      const today = new Date().toISOString().split('T')[0];
      const logs = await medicationService.getAdherenceByDate(elderlyId, today);
      setSchedule(logs.map(l => ({
        prescriptionItemId: l.prescriptionItemId,
        drugName: l.drugName, scheduledTime: l.scheduledTime,
        status: l.status, dosage: undefined,
      })));
    } catch { setError('Không thể tải lịch uống thuốc.'); }
    finally { setLoading(false); }
  }, [elderlyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!notifEnabled) { stopMedicationReminders(); return; }
    startMedicationReminders(() => schedule.filter(m => m.status === 'PENDING'));
    return () => stopMedicationReminders();
  }, [notifEnabled, schedule]);

  const handleMark = async (item: ScheduleItem, status: 'TAKEN' | 'SKIPPED') => {
    setActionId(item.prescriptionItemId);
    try {
      if (elderlyId) {
        const today = new Date().toISOString().split('T')[0];
        if (status === 'TAKEN') {
          await medicationService.markTaken(item.prescriptionItemId, elderlyId, item.drugName, today, item.scheduledTime);
          playAlertSound();
        } else {
          await medicationService.markSkipped(item.prescriptionItemId, elderlyId, item.drugName, today, item.scheduledTime);
        }
      }
    } catch { /* optimistic */ }
    finally {
      setSchedule(prev => prev.map(m => m.prescriptionItemId === item.prescriptionItemId ? { ...m, status } : m));
      setActionId(null);
    }
  };

  const handleToggleNotif = async () => {
    if (!notifEnabled) {
      const granted = await requestNotificationPermission();
      setNotifPermission(getNotificationPermission());
      if (granted) setNotifEnabled(true);
    } else { setNotifEnabled(false); }
  };

  // Drug name autocomplete search
  const handleDrugSearch = (idx: number, query: string) => {
    updateItem(idx, 'drugName', query);
    if (searchTimers.current[idx]) clearTimeout(searchTimers.current[idx]);
    if (!query || query.length < 2) {
      setDrugOptions(prev => prev.map((opts, i) => i === idx ? [] : opts));
      return;
    }
    setDrugSearching(prev => prev.map((v, i) => i === idx ? true : v));
    searchTimers.current[idx] = setTimeout(async () => {
      try {
        const results = await medicationService.searchDrugs(query, 8);
        setDrugOptions(prev => prev.map((opts, i) => i === idx
          ? results.map(r => ({
              id: r.id,
              label: r.brandName ? `${r.genericName} (${r.brandName})` : r.genericName,
              strength: r.strength,
            }))
          : opts,
        ));
      } catch { /* ignore */ } finally {
        setDrugSearching(prev => prev.map((v, i) => i === idx ? false : v));
      }
    }, 300);
  };

  // Add medication
  const handleAddTimeToItem = (idx: number) => {
    setAddItems(prev => prev.map((it, i) => i === idx ? { ...it, scheduledTimes: [...it.scheduledTimes, '12:00'] } : it));
  };
  const handleRemoveTimeFromItem = (itemIdx: number, timeIdx: number) => {
    setAddItems(prev => prev.map((it, i) => i === itemIdx
      ? { ...it, scheduledTimes: it.scheduledTimes.filter((_, ti) => ti !== timeIdx) } : it));
  };
  const updateItem = (idx: number, field: keyof MedItem, val: string) => {
    setAddItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };
  const updateItemTime = (itemIdx: number, timeIdx: number, val: string) => {
    setAddItems(prev => prev.map((it, i) => i === itemIdx ? {
      ...it, scheduledTimes: it.scheduledTimes.map((t, ti) => ti === timeIdx ? val : t),
    } : it));
  };

  const handleSaveAdd = async () => {
    setAddError('');
    const validItems = addItems.filter(it => it.drugName.trim() && it.scheduledTimes.length > 0);
    if (validItems.length === 0) { setAddError('Vui lòng nhập tên thuốc và giờ uống.'); return; }
    setSaving(true);
    try {
      await medicationService.selfAddMedication({
        elderlyId,
        items: validItems.map(it => ({
          drugName: it.drugName.trim(),
          dosage: it.dosage ? +it.dosage : undefined,
          dosageUnit: it.dosageUnit || 'mg',
          scheduledTimes: it.scheduledTimes,
          mealRelation: it.mealRelation,
          instructions: it.instructions,
        })),
        startDate: new Date().toISOString().split('T')[0],
        endDate: addEndDate || undefined,
        notes: addNotes,
      });
      setAddOpen(false);
      setAddItems([{ ...EMPTY_ITEM }]);
      setAddEndDate('');
      setAddNotes('');
      await load();
    } catch (e: any) {
      setAddError(e.response?.data?.message || 'Không thể thêm thuốc. Vui lòng thử lại.');
    } finally { setSaving(false); }
  };

  // ── Excel import handlers ───────────────────────────────────────────────────
  const FREQ_MAP: Record<string, string> = {
    '1 lần': 'ONCE', 'once': 'ONCE',
    '2 lần': 'TWICE_DAILY', 'twice': 'TWICE_DAILY',
    '3 lần': 'THREE_TIMES_DAILY', 'hàng ngày': 'DAILY', 'daily': 'DAILY',
    'hàng tuần': 'WEEKLY', 'khi cần': 'AS_NEEDED',
  };

  const handleXlsxFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setXlsxRows(rows);
      setXlsxDialogOpen(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleXlsxImport = async () => {
    if (!elderlyId || xlsxRows.length === 0) return;
    setXlsxImporting(true);
    try {
      const items = xlsxRows
        .map(row => ({
          drugName: String(row['Tên thuốc'] || row['drug_name'] || ''),
          dosage: parseFloat(String(row['Liều dùng'] || row['dosage'] || '')) || undefined,
          dosageUnit: String(row['Đơn vị'] || row['unit'] || 'mg'),
          scheduledTimes: String(row['Giờ uống'] || row['time'] || '08:00').split(',').map((t: string) => t.trim()).filter(Boolean),
          mealRelation: String(row['Bữa ăn'] || row['meal'] || 'INDEPENDENT'),
          instructions: String(row['Hướng dẫn'] || row['instructions'] || '') || undefined,
        }))
        .filter(item => item.drugName);

      await medicationService.selfAddMedication({ elderlyId, items, startDate: new Date().toISOString().split('T')[0] });
      setXlsxDialogOpen(false);
      setXlsxRows([]);
      await load();
    } catch (e: any) {
      setAddError(e.response?.data?.message || 'Import thất bại. Kiểm tra lại file Excel.');
      setXlsxDialogOpen(false);
    } finally { setXlsxImporting(false); }
  };

  const handleDownloadTemplate = () => {
    const template = [
      { 'Tên thuốc': 'Metformin', 'Liều dùng': 500, 'Đơn vị': 'mg', 'Giờ uống': '08:00, 20:00', 'Bữa ăn': 'AFTER', 'Hướng dẫn': 'Uống sau bữa ăn' },
      { 'Tên thuốc': 'Vitamin C', 'Liều dùng': 500, 'Đơn vị': 'mg', 'Giờ uống': '07:00', 'Bữa ăn': 'INDEPENDENT', 'Hướng dẫn': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Don thuoc');
    XLSX.writeFile(wb, 'mau_don_thuoc.xlsx');
  };

  const pending = schedule.filter(m => m.status === 'PENDING');
  const taken = schedule.filter(m => m.status === 'TAKEN');
  const overdue = pending.filter(m => isOverdue(m.scheduledTime, m.status));
  const adherence = schedule.length > 0 ? Math.round((taken.length / schedule.length) * 100) : 100;
  const visible = showDone ? schedule : schedule.filter(m => m.status !== 'TAKEN');
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <Box sx={{
      '@keyframes fadeInPage': { from: { opacity: 0 }, to: { opacity: 1 } },
      animation: 'fadeInPage 0.4s ease',
    }}>
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <Box sx={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', mb: 3, minHeight: 160 }}>
        <Box component="img"
          src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1200&q=70"
          alt="Medications"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(180,60,0,0.88) 0%, rgba(230,100,30,0.65) 60%, rgba(180,60,0,0.3) 100%)' }} />
        <Box sx={{ position: 'relative', p: { xs: 3, md: 4 }, color: 'white' }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2rem' } }}>💊 Lịch uống thuốc</Typography>
          <Typography sx={{ opacity: 0.85, mt: 0.5 }}>
            {now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })} · 🕐 {nowHHMM}
          </Typography>
          {/* Quick stats */}
          <Box display="flex" gap={2.5} mt={2} flexWrap="wrap">
            {[
              { label: 'Chờ uống', value: pending.length, color: '#FED7AA' },
              { label: 'Đã uống', value: taken.length, color: '#BBF7D0' },
              { label: 'Trễ giờ', value: overdue.length, color: '#FCA5A5' },
            ].map(s => (
              <Box key={s.label} sx={{ textAlign: 'center', bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', borderRadius: '12px', px: 2, py: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</Typography>
                <Typography sx={{ fontSize: '0.78rem', opacity: 0.85 }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {overdue.length > 0 && (
        <Alert severity="error" icon={<NotificationsActiveIcon />} sx={{ mb: 2, borderRadius: '16px', fontWeight: 600 }}>
          ⚠️ Bạn có <strong>{overdue.length} thuốc trễ giờ</strong>: {overdue.map(m => m.drugName).join(', ')}
        </Alert>
      )}

      {/* ── ACTIONS BAR ─────────────────────────────────────────────────── */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5} flexWrap="wrap" gap={1.5}>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{
              borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem',
              background: 'linear-gradient(135deg, #0077B6 0%, #00B4D8 100%)',
              boxShadow: '0 4px 15px rgba(0,119,182,0.3)',
            }}
          >
            Thêm thuốc mới
          </Button>
          <Button
            variant="outlined"
            startIcon={<SmartToyIcon />}
            onClick={() => openChat('Tôi muốn hỏi về thuốc và lịch uống thuốc')}
            sx={{ borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', borderColor: '#0077B6', color: '#0077B6' }}
          >
            Hỏi AI về thuốc
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => xlsxInputRef.current?.click()}
            sx={{ borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', borderColor: '#16A34A', color: '#16A34A' }}
          >
            Import Excel
          </Button>
          <Button
            variant="text"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
            sx={{ borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', color: '#64748B' }}
          >
            Tải file mẫu
          </Button>
          <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleXlsxFile} />
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <Box
            onClick={notifPermission !== 'denied' ? handleToggleNotif : undefined}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
              px: 1.5, py: 0.75, borderRadius: '10px',
              bgcolor: notifEnabled ? '#EFF6FF' : '#F8FAFC',
              border: `1.5px solid ${notifEnabled ? '#93C5FD' : '#E2E8F0'}`,
            }}
          >
            {notifEnabled ? <NotificationsActiveIcon sx={{ color: '#1D4ED8', fontSize: '1.3rem' }} /> : <NotificationsOffIcon sx={{ color: '#94A3B8', fontSize: '1.3rem' }} />}
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: notifEnabled ? '#1D4ED8' : '#94A3B8' }}>
              {notifEnabled ? 'Nhắc nhở BẬT' : 'Bật nhắc'}
            </Typography>
          </Box>
          <IconButton onClick={load} sx={{ bgcolor: '#F1F5F9', borderRadius: '10px' }}>
            <RefreshIcon sx={{ color: '#475569' }} />
          </IconButton>
        </Box>
      </Box>

      {/* ── PROGRESS ────────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: '18px', border: '1.5px solid #E2E8F0', mb: 2.5 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#374151' }}>Tiến độ hôm nay</Typography>
          <Typography sx={{ fontWeight: 800, color: adherence === 100 ? '#16A34A' : '#0077B6', fontSize: '1.05rem' }}>
            {taken.length}/{schedule.length} thuốc ({adherence}%)
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={adherence} sx={{
          height: 10, borderRadius: 5, bgcolor: '#E2E8F0',
          '& .MuiLinearProgress-bar': {
            borderRadius: 5, bgcolor: adherence === 100 ? '#16A34A' : adherence > 60 ? '#0077B6' : '#F59E0B',
          },
        }} />
        {adherence === 100 && schedule.length > 0 && (
          <Typography sx={{ textAlign: 'center', color: '#16A34A', fontWeight: 700, mt: 1.5, fontSize: '1rem' }}>
            🎉 Tuyệt vời! Đã uống đủ tất cả thuốc hôm nay!
          </Typography>
        )}
      </Paper>

      <Box display="flex" justifyContent="flex-end" mb={2}>
        <FormControlLabel
          control={<Switch checked={showDone} onChange={e => setShowDone(e.target.checked)} color="primary" />}
          label={<Typography sx={{ fontSize: '0.9rem', color: '#475569' }}>Hiện thuốc đã uống</Typography>}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '14px' }}>{error}</Alert>}

      {/* ── MEDICATION TIPS STRIP ───────────────────────────────────────── */}
      {!loading && schedule.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5, mb: 2.5 }}>
          {[
            { icon: '💧', tip: 'Uống thuốc với đủ nước (200ml) để hấp thu tốt hơn' },
            { icon: '⏰', tip: 'Uống thuốc đúng giờ giúp duy trì nồng độ ổn định' },
            { icon: '🍽️', tip: 'Chú ý hướng dẫn uống trước/sau bữa ăn' },
            { icon: '❌', tip: 'Không tự ý bỏ thuốc dù cảm thấy khoẻ hơn' },
          ].map((item, i) => (
            <Box key={i} sx={{
              minWidth: 155, p: 1.5, borderRadius: '14px', flexShrink: 0,
              bgcolor: 'white', border: '1.5px solid #E2E8F0',
              transition: 'all 0.25s',
              '&:hover': { borderColor: '#0077B6', transform: 'translateY(-3px)', boxShadow: '0 6px 20px rgba(0,119,182,0.12)' },
              '@keyframes tipIn': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              animation: `tipIn 0.4s ease ${i * 0.08}s both`,
            }}>
              <Typography sx={{ fontSize: '1.4rem', mb: 0.5 }}>{item.icon}</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>{item.tip}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* ── SCHEDULE LIST ───────────────────────────────────────────────── */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress size={52} /></Box>
      ) : visible.length === 0 ? (
        <Paper elevation={0} sx={{ borderRadius: '20px', border: '2px dashed #CBD5E1', overflow: 'hidden' }}>
          <Box
            component="img"
            src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=60"
            alt="Pharmacy"
            sx={{ width: '100%', height: 140, objectFit: 'cover', opacity: 0.5 }}
          />
          <Box textAlign="center" py={3} px={2}>
            {schedule.length === 0 ? (
              <>
                <MedicationIcon sx={{ fontSize: '4rem', color: '#CBD5E1', mb: 1 }} />
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: '#475569' }}>Chưa có đơn thuốc nào hôm nay</Typography>
                <Typography sx={{ color: '#94A3B8', mt: 0.5 }}>Nhấn "Thêm thuốc mới" để tự thêm lịch uống thuốc của bạn</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
                  sx={{ mt: 2, borderRadius: '12px', background: 'linear-gradient(135deg, #0077B6 0%, #00B4D8 100%)' }}>
                  Thêm thuốc ngay
                </Button>
              </>
            ) : (
              <>
                <CheckCircleIcon sx={{ fontSize: '4rem', color: '#16A34A', mb: 1 }} />
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#16A34A' }}>Đã uống hết thuốc hôm nay! 🎉</Typography>
              </>
            )}
          </Box>
        </Paper>
      ) : (
        <Box display="flex" flexDirection="column" gap={1.5}>
          {visible.map((item, idx) => {
            const isLate = isOverdue(item.scheduledTime, item.status);
            const isActioning = actionId === item.prescriptionItemId;
            const isTaken = item.status === 'TAKEN';
            const isSkipped = item.status === 'SKIPPED';

            return (
              <Paper
                key={`${item.prescriptionItemId}-${item.scheduledTime}`}
                elevation={0}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  p: 2, borderRadius: '16px',
                  border: `1.5px solid ${isLate ? '#FCA5A5' : isTaken ? '#BBF7D0' : isSkipped ? '#E2E8F0' : '#FED7AA'}`,
                  bgcolor: isLate ? '#FFF5F5' : isTaken ? '#F0FFF4' : isSkipped ? '#F8FAFC' : '#FFFBEB',
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                  opacity: isSkipped ? 0.65 : 1,
                  transition: 'all 0.25s ease',
                  '&:hover': { transform: 'translateX(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
                  '@keyframes medSlide': { from: { opacity: 0, transform: 'translateX(-16px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                  animation: `medSlide 0.4s ease ${idx * 0.06}s both`,
                }}
              >
                {/* Time bubble */}
                <Box sx={{
                  minWidth: 72, textAlign: 'center', p: 1.5, borderRadius: '12px', flexShrink: 0,
                  bgcolor: isTaken ? '#DCFCE7' : isLate ? '#FEE2E2' : '#FEF3C7',
                }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1, color: isTaken ? '#15803D' : isLate ? '#DC2626' : '#B45309' }}>
                    {item.scheduledTime}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: '#94A3B8', mt: 0.3 }}>
                    {isLate && !isTaken ? '⚠️ Trễ' : '⏰'}
                  </Typography>
                </Box>

                {/* Drug info */}
                <Box flex={1} minWidth={0}>
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: isTaken ? '#DCFCE7' : '#FEF3C7', flexShrink: 0 }}>
                      <MedicationIcon sx={{ fontSize: '1.1rem', color: isTaken ? '#15803D' : '#D97706' }} />
                    </Avatar>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#1E293B' }} noWrap>
                      {item.drugName}
                    </Typography>
                    <Chip
                      label={isTaken ? '✅ Đã uống' : isSkipped ? '⏭️ Bỏ qua' : isLate ? '⚠️ Trễ' : '⏳ Chờ'}
                      size="small"
                      sx={{
                        fontWeight: 700, fontSize: '0.78rem',
                        bgcolor: isTaken ? '#DCFCE7' : isSkipped ? '#F1F5F9' : isLate ? '#FEE2E2' : '#FEF3C7',
                        color: isTaken ? '#15803D' : isSkipped ? '#64748B' : isLate ? '#DC2626' : '#B45309',
                      }}
                    />
                  </Box>
                  <Box display="flex" gap={0.75} mt={0.75} flexWrap="wrap">
                    {item.dosage && <Chip label={`${item.dosage}${item.dosageUnit || 'mg'}`} size="small" variant="outlined" sx={{ fontSize: '0.8rem' }} />}
                    {item.mealRelation && MEAL_LABELS[item.mealRelation] && <Chip label={MEAL_LABELS[item.mealRelation]} size="small" variant="outlined" sx={{ fontSize: '0.8rem' }} />}
                    {item.instructions && <Typography sx={{ fontSize: '0.82rem', color: '#64748B', fontStyle: 'italic' }}>📋 {item.instructions}</Typography>}
                  </Box>
                </Box>

                {/* Actions */}
                {item.status === 'PENDING' && (
                  <Box display="flex" gap={1} flexShrink={0} flexWrap="wrap">
                    <Button
                      variant="contained" size="small"
                      startIcon={isActioning ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                      onClick={() => handleMark(item, 'TAKEN')}
                      disabled={!!actionId}
                      sx={{ borderRadius: '10px', fontWeight: 700, bgcolor: '#16A34A', '&:hover': { bgcolor: '#15803D' }, fontSize: '0.9rem', py: 0.9 }}
                    >Đã uống</Button>
                    <Button
                      variant="outlined" size="small"
                      startIcon={<SkipNextIcon />}
                      onClick={() => handleMark(item, 'SKIPPED')}
                      disabled={!!actionId}
                      sx={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', py: 0.9 }}
                    >Bỏ qua</Button>
                  </Box>
                )}
                {isTaken && <CheckCircleIcon sx={{ fontSize: '2.5rem', color: '#16A34A', flexShrink: 0 }} />}
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Tips */}
      <Paper elevation={0} sx={{ mt: 3, p: 2.5, borderRadius: '18px', bgcolor: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
        <Typography sx={{ fontWeight: 700, color: '#1D4ED8', mb: 1 }}>💡 Nhắc nhở quan trọng</Typography>
        {['Uống thuốc đúng giờ để duy trì hiệu quả điều trị.', 'Không tự ý ngừng thuốc kể cả khi cảm thấy khoẻ hơn.',
          'Nếu quên, uống ngay khi nhớ (trừ khi gần giờ uống tiếp theo).', 'Bật "Nhắc nhở" để nhận thông báo khi đến giờ.'].map(tip => (
          <Typography key={tip} sx={{ fontSize: '0.9rem', color: '#1E40AF', mb: 0.5 }}>• {tip}</Typography>
        ))}
      </Paper>

      {/* ── ADD MEDICATION DIALOG ────────────────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => !saving && setAddOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#0D1B2A', pb: 1 }}>
          💊 Thêm thuốc mới
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          {addError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{addError}</Alert>}

          {addItems.map((item, idx) => (
            <Box key={idx} sx={{ mb: 3, p: 2.5, bgcolor: '#F8FAFC', borderRadius: '16px', border: '1.5px solid #E2E8F0' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography sx={{ fontWeight: 700, color: '#374151' }}>Thuốc {idx + 1}</Typography>
                {addItems.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => setAddItems(prev => prev.filter((_, i) => i !== idx))}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Autocomplete
                    freeSolo
                    options={drugOptions[idx] || []}
                    getOptionLabel={o => (typeof o === 'string' ? o : o.label)}
                    inputValue={item.drugName}
                    onInputChange={(_, val) => handleDrugSearch(idx, val)}
                    onChange={(_, val) => {
                      if (!val) { updateItem(idx, 'drugName', ''); return; }
                      const name = typeof val === 'string' ? val : val.label.split(' (')[0];
                      updateItem(idx, 'drugName', name);
                      if (typeof val !== 'string' && val.strength) {
                        const num = val.strength.replace(/[^0-9.]/g, '');
                        const unit = val.strength.replace(/[0-9. ]/g, '') || 'mg';
                        if (num) updateItem(idx, 'dosage', num);
                        if (unit) updateItem(idx, 'dosageUnit', unit);
                      }
                    }}
                    loading={drugSearching[idx]}
                    noOptionsText={item.drugName.length >= 2 ? 'Không tìm thấy thuốc' : 'Nhập ít nhất 2 ký tự'}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tên thuốc *"
                        placeholder="VD: Paracetamol, Amlodipine..."
                        InputProps={{
                          ...params.InputProps,
                          sx: { borderRadius: '10px', bgcolor: 'white' },
                          endAdornment: (
                            <>
                              {drugSearching[idx] && <CircularProgress size={16} sx={{ mr: 1 }} />}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} key={option.id}>
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            {typeof option === 'string' ? option : option.label.split(' (')[0]}
                          </Typography>
                          {typeof option !== 'string' && option.label.includes('(') && (
                            <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>
                              {option.label.match(/\(([^)]+)\)/)?.[1]}
                            </Typography>
                          )}
                          {typeof option !== 'string' && option.strength && (
                            <Typography sx={{ fontSize: '0.78rem', color: '#2E5C7F', fontWeight: 600 }}>
                              Hàm lượng: {option.strength}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth label="Liều lượng" type="number" placeholder="VD: 5" value={item.dosage}
                    onChange={e => updateItem(idx, 'dosage', e.target.value)}
                    InputProps={{ sx: { borderRadius: '10px', bgcolor: 'white' } }} />
                </Grid>
                <Grid item xs={6}>
                  <TextField select fullWidth label="Đơn vị" value={item.dosageUnit}
                    onChange={e => updateItem(idx, 'dosageUnit', e.target.value)}
                    InputProps={{ sx: { borderRadius: '10px', bgcolor: 'white' } }}>
                    {['mg', 'ml', 'mcg', 'IU', 'viên', 'gói'].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField select fullWidth label="Thời điểm uống" value={item.mealRelation}
                    onChange={e => updateItem(idx, 'mealRelation', e.target.value)}
                    InputProps={{ sx: { borderRadius: '10px', bgcolor: 'white' } }}>
                    {MEAL_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </TextField>
                </Grid>

                {/* Scheduled times */}
                <Grid item xs={12}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151', mb: 1 }}>
                    ⏰ Giờ uống thuốc *
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                    {item.scheduledTimes.map((t, ti) => (
                      <Box key={ti} display="flex" alignItems="center" gap={0.5}>
                        <TextField
                          type="time" value={t} size="small"
                          onChange={e => updateItemTime(idx, ti, e.target.value)}
                          InputProps={{ sx: { borderRadius: '8px', bgcolor: 'white', fontWeight: 700, fontSize: '1rem' } }}
                          sx={{ width: 120 }}
                        />
                        {item.scheduledTimes.length > 1 && (
                          <IconButton size="small" onClick={() => handleRemoveTimeFromItem(idx, ti)}>
                            <DeleteIcon fontSize="small" sx={{ color: '#EF4444' }} />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddTimeToItem(idx)}
                      sx={{ borderRadius: '8px', color: '#0077B6', fontWeight: 600 }}>
                      Thêm giờ
                    </Button>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <TextField fullWidth label="Hướng dẫn (tuỳ chọn)" placeholder="VD: Uống với nước ấm..." value={item.instructions}
                    onChange={e => updateItem(idx, 'instructions', e.target.value)}
                    InputProps={{ sx: { borderRadius: '10px', bgcolor: 'white' } }} />
                </Grid>
              </Grid>
            </Box>
          ))}

          <Button startIcon={<AddIcon />} onClick={() => setAddItems(prev => [...prev, { ...EMPTY_ITEM }])}
            sx={{ borderRadius: '10px', color: '#0077B6', fontWeight: 600, mb: 2 }}>
            + Thêm thuốc khác
          </Button>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="date" label="Ngày kết thúc (tuỳ chọn)" value={addEndDate}
                onChange={e => setAddEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: new Date().toISOString().split('T')[0] }}
                InputProps={{ sx: { borderRadius: '10px' } }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Ghi chú" value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                InputProps={{ sx: { borderRadius: '10px' } }} />
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setAddOpen(false)} disabled={saving} sx={{ borderRadius: '10px', fontWeight: 600 }}>Huỷ</Button>
          <Button variant="contained" onClick={handleSaveAdd} disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
            sx={{ borderRadius: '10px', fontWeight: 700, background: 'linear-gradient(135deg, #0077B6 0%, #00B4D8 100)', px: 3 }}>
            {saving ? 'Đang lưu...' : 'Lưu thuốc'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── EXCEL IMPORT DIALOG ─────────────────────────────────────────── */}
      <Dialog open={xlsxDialogOpen} onClose={() => !xlsxImporting && setXlsxDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#16A34A', pb: 1 }}>
          📥 Xem trước danh sách thuốc từ Excel
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {xlsxRows.length === 0 ? (
            <Typography color="text.secondary">Không có dữ liệu hợp lệ trong file.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#F0FDF4' }}>
                    {Object.keys(xlsxRows[0]).map(col => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #D1FAE5', fontWeight: 700, color: '#15803D', whiteSpace: 'nowrap' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {xlsxRows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#F8FFF9' }}>
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #E2E8F0', color: '#374151' }}>{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Typography sx={{ mt: 1.5, fontSize: '0.83rem', color: '#64748B' }}>
                Tổng: <strong>{xlsxRows.length}</strong> thuốc sẽ được thêm vào lịch hôm nay.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setXlsxDialogOpen(false)} disabled={xlsxImporting} sx={{ borderRadius: '10px' }}>Huỷ</Button>
          <Button variant="contained" onClick={handleXlsxImport} disabled={xlsxImporting || xlsxRows.length === 0}
            startIcon={xlsxImporting ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
            sx={{ borderRadius: '10px', fontWeight: 700, bgcolor: '#16A34A', px: 3 }}>
            {xlsxImporting ? 'Đang import...' : `Import ${xlsxRows.length} thuốc`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MedicationSchedulePage;
