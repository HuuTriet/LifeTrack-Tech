import React, { useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Badge, Avatar,
  BottomNavigation, BottomNavigationAction, Paper, Fab, Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MedicationIcon from '@mui/icons-material/Medication';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import { useAuthStore } from '../store/authStore';
import MedicationAlarmDialog, { useMedicationAlarm, AlarmMed } from '../components/common/MedicationAlarmOverlay';
import AiChatPopup from '../components/common/AiChatPopup';
import { AiChatProvider, useAiChat } from '../contexts/AiChatContext';
import api from '../services/api';

const NAV_ITEMS = [
  { label: 'Trang chủ', icon: <DashboardIcon />, path: '/elderly/dashboard' },
  { label: 'Thuốc', icon: <MedicationIcon />, path: '/elderly/medications' },
  { label: 'Sức khoẻ', icon: <FavoriteIcon />, path: '/elderly/health-check' },
  { label: 'Lịch hẹn', icon: <CalendarMonthIcon />, path: '/elderly/appointments' },
  { label: 'Vận động', icon: <DirectionsWalkIcon />, path: '/elderly/activity' },
  { label: 'Thông báo email', icon: <MarkEmailReadIcon />, path: '/elderly/email-notifications' },
];

const ElderlyLayoutInner: React.FC = () => {
  const { user, token, logout, getElderlyId } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const swListenerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const { toggleChat } = useAiChat();

  // Alarm overlay hook
  const { current: alarmCurrent, pushAlarm, dismiss, handleTaken, handleSnooze } = useMedicationAlarm();

  // Client-side polling fallback: check for due medications every 60s
  useEffect(() => {
    const elderlyId = getElderlyId();
    if (!token || !elderlyId) return;

    const notified = new Set<string>();

    const checkDue = async () => {
      try {
        const res = await api.get(`/health/elderly/${elderlyId}/dashboard`);
        const schedule: any[] = res.data?.medications?.schedule ?? [];
        const pending = schedule.filter((m: any) => m.status === 'PENDING');
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const WINDOW = 5;

        for (const med of pending) {
          const [h, m] = (med.scheduledTime || '').split(':').map(Number);
          if (isNaN(h)) continue;
          const scheduledMin = h * 60 + m;
          const diff = scheduledMin - nowMin;
          const isDue = diff >= 0 && diff <= WINDOW;
          const isOverdue = diff < 0 && diff >= -WINDOW;
          if (!isDue && !isOverdue) continue;

          const key = `${med.prescriptionItemId}-${med.scheduledTime}-${now.toDateString()}`;
          if (notified.has(key)) continue;
          notified.add(key);

          pushAlarm({ ...med, overdue: isOverdue });

          // Auto-send email reminder if user has verified notification email
          const notifEmail = localStorage.getItem('lt_notif_email');
          const notifVerified = localStorage.getItem('lt_notif_email_verified') === 'true';
          if (notifEmail && notifVerified) {
            const emailKey = `email-sent-${key}`;
            if (!notified.has(emailKey)) {
              notified.add(emailKey);
              try {
                await api.post('/medications/reminders/send-email', {
                  elderlyId,
                  recipientEmail: notifEmail,
                  patientName: (user as any)?.name || (user as any)?.fullName || 'Bệnh nhân',
                });
              } catch { /* ignore email errors */ }
            }
          }
        }
      } catch { /* ignore */ }
    };

    checkDue();
    const timer = setInterval(checkDue, 60_000);
    return () => clearInterval(timer);
  }, [token, getElderlyId, pushAlarm]);

  // Send credentials to SW and listen for alarm messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const elderlyId = getElderlyId();

    // Request notification permission if not yet granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active && token && elderlyId) {
        reg.active.postMessage({ type: 'CREDENTIALS', token, elderlyId });
      }
    });

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'MED_DUE' || e.data?.type === 'MED_OVERDUE') {
        const med: AlarmMed = {
          ...e.data.med,
          overdue: e.data.type === 'MED_OVERDUE',
        };
        pushAlarm(med);

        // Auto-send email reminder from SW trigger
        const notifEmail = localStorage.getItem('lt_notif_email');
        const notifVerified = localStorage.getItem('lt_notif_email_verified') === 'true';
        const swEmailKey = `sw-email-${med.prescriptionItemId}-${med.scheduledTime}-${new Date().toDateString()}`;
        if (notifEmail && notifVerified && !sessionStorage.getItem(swEmailKey)) {
          sessionStorage.setItem(swEmailKey, '1');
          const elderlyId = getElderlyId();
          if (elderlyId) {
            api.post('/medications/reminders/send-email', {
              elderlyId,
              recipientEmail: notifEmail,
              patientName: (user as any)?.name || (user as any)?.fullName || 'Bệnh nhân',
            }).catch(() => {});
          }
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    swListenerRef.current = onMessage;

    return () => {
      if (swListenerRef.current) {
        navigator.serviceWorker.removeEventListener('message', swListenerRef.current);
      }
    };
  }, [token, getElderlyId, pushAlarm]);

  const handleLogout = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'LOGOUT' });
      });
    }
    logout();
    navigate('/login');
  };

  const currentNav = NAV_ITEMS.findIndex(n => location.pathname.startsWith(n.path));

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #FAF8F5 0%, #FEFDFB 100%)',
        display: 'flex',
        flexDirection: 'column',
        pb: { xs: 7, sm: 0 },
      }}
    >
      {/* Header */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: '#FFFFFF',
          borderBottom: '2px solid #E8F0F7',
          color: '#2C3E50',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', py: 1.5 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 48, height: 48, borderRadius: '12px',
                background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '1.2rem',
              }}
            >
              LT
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#2E5C7F', fontSize: '1.5rem' }}>
              LifeTrack Tech
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <IconButton
              size="large"
              aria-label="Thông báo"
              sx={{ bgcolor: '#EBF4FB', borderRadius: '12px' }}
            >
              <Badge badgeContent={0} color="error">
                <NotificationsIcon sx={{ color: '#2E5C7F', fontSize: '1.75rem' }} />
              </Badge>
            </IconButton>

            {/* AI button in header */}
            <Tooltip title="Trợ lý AI Sức khoẻ">
              <IconButton
                onClick={toggleChat}
                sx={{
                  bgcolor: 'linear-gradient(135deg, #EBF4FB 0%, #E0F2FE 100%)',
                  background: 'linear-gradient(135deg, #EBF4FB 0%, #E0F2FE 100%)',
                  borderRadius: '12px',
                  border: '1.5px solid #C8E6FA',
                }}
              >
                <SmartToyIcon sx={{ color: '#2E5C7F', fontSize: '1.5rem' }} />
              </IconButton>
            </Tooltip>

            <Box
              display="flex" alignItems="center" gap={1.5}
              sx={{ bgcolor: '#EBF4FB', borderRadius: '50px', px: 2, py: 1 }}
            >
              <Avatar sx={{ width: 36, height: 36, bgcolor: '#E88D5D', fontSize: '0.9rem' }}>
                {user?.name?.slice(0, 2).toUpperCase() || 'U'}
              </Avatar>
              <Typography sx={{ fontWeight: 600, color: '#2E5C7F', fontSize: '1rem', display: { xs: 'none', sm: 'block' } }}>
                {user?.name || 'Người dùng'}
              </Typography>
            </Box>

            <IconButton
              onClick={handleLogout}
              aria-label="Đăng xuất"
              sx={{ bgcolor: '#FEF0EC', borderRadius: '12px' }}
            >
              <LogoutIcon sx={{ color: '#E76F51', fontSize: '1.5rem' }} />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Desktop sidebar nav (md+) */}
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, flex: 1 }}>
        <Box
          component="nav"
          sx={{
            width: 220, flexShrink: 0,
            borderRight: '2px solid #E8F0F7',
            bgcolor: '#FFFFFF',
            pt: 3, pb: 3,
            display: 'flex', flexDirection: 'column', gap: 0.5,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Box
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 2.5, py: 1.5, mx: 1,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  bgcolor: active ? '#EBF4FB' : 'transparent',
                  color: active ? '#2E5C7F' : '#7A8B99',
                  fontWeight: active ? 700 : 500,
                  fontSize: '1rem',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: '#F0F8FF', color: '#2E5C7F' },
                  borderLeft: active ? '4px solid #2E5C7F' : '4px solid transparent',
                }}
              >
                <Box sx={{ display: 'flex', color: 'inherit' }}>{item.icon}</Box>
                <Typography sx={{ fontWeight: 'inherit', fontSize: 'inherit', color: 'inherit' }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}

          {/* AI button in sidebar */}
          <Box
            onClick={toggleChat}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 2.5, py: 1.5, mx: 1, mt: 1,
              borderRadius: '12px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #EBF4FB 0%, #E0F2FE 100%)',
              color: '#2E5C7F',
              fontWeight: 600,
              fontSize: '1rem',
              border: '1.5px solid #C8E6FA',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: '#D0E8F5' },
            }}
          >
            <Box sx={{ display: 'flex', color: '#2E5C7F' }}><SmartToyIcon /></Box>
            <Typography sx={{ fontWeight: 'inherit', fontSize: 'inherit', color: 'inherit' }}>
              AI Hỗ trợ
            </Typography>
          </Box>
        </Box>

        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, overflowY: 'auto' }}>
          <Box maxWidth={1000} mx="auto">
            <Outlet />
          </Box>
        </Box>
      </Box>

      {/* Mobile: main content fills screen */}
      <Box component="main" sx={{ display: { xs: 'block', sm: 'none' }, flex: 1, p: 2 }}>
        <Outlet />
      </Box>

      {/* Mobile bottom navigation */}
      <Paper
        elevation={3}
        sx={{
          display: { xs: 'block', sm: 'none' },
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 1100,
          borderTop: '2px solid #E8F0F7',
        }}
      >
        <BottomNavigation
          value={currentNav}
          onChange={(_, newValue) => navigate(NAV_ITEMS[newValue].path)}
          sx={{ height: 64 }}
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
              sx={{
                '&.Mui-selected': { color: '#2E5C7F' },
                fontSize: '0.7rem',
                minWidth: 0,
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>

      {/* Floating AI button (mobile) */}
      <Tooltip title="Trợ lý AI" placement="left">
        <Fab
          onClick={toggleChat}
          sx={{
            display: { xs: 'flex', sm: 'none' },
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 1200,
            width: 52,
            height: 52,
            background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(46,92,127,0.4)',
            '&:hover': { transform: 'scale(1.08)' },
            transition: 'transform 0.2s',
          }}
        >
          <SmartToyIcon sx={{ fontSize: '1.5rem' }} />
        </Fab>
      </Tooltip>

      {/* AI Chat Popup — available on all pages */}
      <AiChatPopup />

      {/* Medication alarm popup */}
      <MedicationAlarmDialog
        alarm={alarmCurrent}
        onDismiss={dismiss}
        onTaken={handleTaken}
        onSnooze={handleSnooze}
      />
    </Box>
  );
};

const ElderlyLayout: React.FC = () => (
  <AiChatProvider>
    <ElderlyLayoutInner />
  </AiChatProvider>
);

export default ElderlyLayout;
