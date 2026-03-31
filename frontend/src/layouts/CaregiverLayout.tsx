import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Badge,
  Avatar, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Divider, Tooltip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MedicationIcon from '@mui/icons-material/Medication';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PersonIcon from '@mui/icons-material/Person';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useAuthStore } from '../store/authStore';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { label: 'Tổng quan', icon: <DashboardIcon />, path: '/caregiver/dashboard' },
  { label: 'Hồ sơ bệnh nhân', icon: <PeopleAltIcon />, path: '/caregiver/elderly' },
  { label: 'Thêm đơn thuốc', icon: <MedicationIcon />, path: '/caregiver/medications/add' },
  { label: 'Xu hướng sức khoẻ', icon: <MonitorHeartIcon />, path: '/caregiver/health-trends' },
  { label: 'Thông báo', icon: <NotificationsIcon />, path: '/caregiver/notifications' },
  { label: 'Tài khoản', icon: <PersonIcon />, path: '/caregiver/profile' },
  { label: 'Trợ giúp', icon: <HelpOutlineIcon />, path: '/caregiver/help' },
];

const NAV_LABELS: Record<string, string> = {
  '/caregiver/dashboard': 'Tổng quan',
  '/caregiver/elderly': 'Hồ sơ bệnh nhân',
  '/caregiver/medications/add': 'Thêm đơn thuốc',
  '/caregiver/health-trends': 'Xu hướng sức khoẻ',
  '/caregiver/notifications': 'Thông báo',
  '/caregiver/profile': 'Tài khoản',
  '/caregiver/help': 'Trợ giúp',
};

const CaregiverLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{
        p: 2.5,
        background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '12px',
          bgcolor: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '1.1rem',
        }}>
          LT
        </Box>
        <Box>
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
            LifeTrack Tech
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.75rem' }}>
            Người chăm sóc
          </Typography>
        </Box>
      </Box>

      {/* Nav Items */}
      <List sx={{ px: 1.5, pt: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                sx={{
                  borderRadius: '12px',
                  bgcolor: active ? '#EBF4FB' : 'transparent',
                  color: active ? '#2E5C7F' : '#7A8B99',
                  '&:hover': { bgcolor: '#EBF4FB', color: '#2E5C7F' },
                  transition: 'all 0.18s',
                  borderLeft: active ? '4px solid #2E5C7F' : '4px solid transparent',
                  pl: active ? 1.75 : 2,
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 38 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: '0.92rem' }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* User info */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: '#E88D5D', width: 40, height: 40, fontSize: '0.95rem', fontWeight: 700 }}>
          {user?.name?.slice(0, 2).toUpperCase() || 'CG'}
        </Avatar>
        <Box flex={1} minWidth={0}>
          <Typography sx={{ fontWeight: 600, color: '#2C3E50', fontSize: '0.88rem' }} noWrap>
            {user?.name || 'Người chăm sóc'}
          </Typography>
          <Typography sx={{ color: '#7A8B99', fontSize: '0.75rem' }}>
            Caregiver
          </Typography>
        </Box>
        <Tooltip title="Đăng xuất">
          <IconButton size="small" onClick={handleLogout}>
            <LogoutIcon sx={{ color: '#E76F51', fontSize: '1.2rem' }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  const pageTitle = NAV_LABELS[location.pathname]
    ?? (location.pathname.match(/^\/caregiver\/elderly\/.+/) ? 'Chi tiết bệnh nhân' : 'LifeTrack Tech');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F4F6F9' }}>
      {/* Sidebar Desktop */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH, flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH, boxSizing: 'border-box',
            border: 'none', boxShadow: '4px 0 20px rgba(46,92,127,0.08)',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Sidebar Mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top AppBar */}
        <AppBar
          position="sticky" elevation={0}
          sx={{ bgcolor: '#FFFFFF', borderBottom: '1.5px solid #E8F0F7', color: '#2C3E50' }}
        >
          <Toolbar>
            <IconButton sx={{ mr: 2, display: { md: 'none' } }} onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, color: '#2E5C7F', fontSize: '1.1rem' }}>
              {pageTitle}
            </Typography>
            <Tooltip title="Thông báo">
              <IconButton onClick={() => navigate('/caregiver/notifications')}>
                <Badge badgeContent={3} color="error">
                  <NotificationsIcon sx={{ color: '#2E5C7F' }} />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Tài khoản">
              <Avatar
                onClick={() => navigate('/caregiver/profile')}
                sx={{ width: 36, height: 36, bgcolor: '#E88D5D', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', ml: 1 }}
              >
                {user?.name?.slice(0, 2).toUpperCase() || 'CG'}
              </Avatar>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default CaregiverLayout;
