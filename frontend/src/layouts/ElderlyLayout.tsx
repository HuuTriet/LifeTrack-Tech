import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Badge, Avatar,
  BottomNavigation, BottomNavigationAction, Paper,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MedicationIcon from '@mui/icons-material/Medication';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import { useAuthStore } from '../store/authStore';

const NAV_ITEMS = [
  { label: 'Trang chủ', icon: <DashboardIcon />, path: '/elderly/dashboard' },
  { label: 'Thuốc', icon: <MedicationIcon />, path: '/elderly/medications' },
  { label: 'Sức khoẻ', icon: <FavoriteIcon />, path: '/elderly/health-check' },
  { label: 'Lịch hẹn', icon: <CalendarMonthIcon />, path: '/elderly/appointments' },
  { label: 'Vận động', icon: <DirectionsWalkIcon />, path: '/elderly/activity' },
];

const ElderlyLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Find current nav index
  const currentNav = NAV_ITEMS.findIndex(n => location.pathname.startsWith(n.path));

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #FAF8F5 0%, #FEFDFB 100%)',
        display: 'flex',
        flexDirection: 'column',
        // Account for fixed bottom nav
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
          {/* Logo */}
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

          {/* User + Actions */}
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton
              size="large"
              aria-label="Thông báo"
              onClick={() => navigate('/elderly/notifications')}
              sx={{ bgcolor: '#EBF4FB', borderRadius: '12px' }}
            >
              <Badge badgeContent={0} color="error">
                <NotificationsIcon sx={{ color: '#2E5C7F', fontSize: '1.75rem' }} />
              </Badge>
            </IconButton>

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
        </Box>

        {/* Main content */}
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
    </Box>
  );
};

export default ElderlyLayout;
