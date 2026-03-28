import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Avatar,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MedicationIcon from '@mui/icons-material/Medication';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useAuthStore } from '../store/authStore';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/caregiver/dashboard' },
  { label: 'Elderly Profiles', icon: <AddCircleOutlineIcon />, path: '/caregiver/elderly' },
  { label: 'Add Medication', icon: <MedicationIcon />, path: '/caregiver/medications/add' },
  { label: 'Health Trends', icon: <MonitorHeartIcon />, path: '/caregiver/health-trends' },
  { label: 'Notifications', icon: <NotificationsIcon />, path: '/caregiver/notifications' },
  { label: 'Reports', icon: <DashboardIcon />, path: '/caregiver/reports' },
  { label: 'Profile', icon: <AddCircleOutlineIcon />, path: '/caregiver/profile' },
  { label: 'Help', icon: <AddCircleOutlineIcon />, path: '/caregiver/help' },
];

/**
 * Caregiver Layout:
 * - Professional dashboard sidebar
 * - Full navigation
 * - Charts and detailed views
 */
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
      {/* Sidebar Logo */}
      <Box
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #2E5C7F 0%, #4A8FB8 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: '10px',
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '1.1rem',
          }}
        >
          LT
        </Box>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
          LifeTrack Tech
        </Typography>
      </Box>

      {/* Nav Items */}
      <List sx={{ px: 1.5, pt: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                sx={{
                  borderRadius: '12px',
                  bgcolor: active ? '#EBF4FB' : 'transparent',
                  color: active ? '#2E5C7F' : '#7A8B99',
                  fontWeight: active ? 700 : 400,
                  '&:hover': { bgcolor: '#EBF4FB', color: '#2E5C7F' },
                  transition: 'all 0.2s',
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: '0.95rem' }}
                />
                {active && (
                  <Box
                    sx={{
                      width: 4,
                      height: 24,
                      borderRadius: 2,
                      bgcolor: '#2E5C7F',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* User info at bottom */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: '#E88D5D', width: 38, height: 38, fontSize: '0.9rem' }}>
          {user?.avatarInitials || user?.name?.slice(0, 2).toUpperCase() || 'CG'}
        </Avatar>
        <Box flex={1}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#2C3E50' }}>
            {user?.name || 'Caregiver'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#7A8B99' }}>
            Người chăm sóc
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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F4F6F9' }}>
      {/* Sidebar Desktop */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
            boxShadow: '4px 0 20px rgba(46,92,127,0.08)',
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
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top AppBar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: '#FFFFFF', borderBottom: '1px solid #E8F0F7', color: '#2C3E50' }}
        >
          <Toolbar>
            <IconButton
              sx={{ mr: 2, display: { md: 'none' } }}
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, color: '#2E5C7F' }}>
              {NAV_ITEMS.find((n) => n.path === location.pathname)?.label || 'LifeTrack Tech'}
            </Typography>
            <IconButton>
              <Badge badgeContent={3} color="error">
                <NotificationsIcon sx={{ color: '#2E5C7F' }} />
              </Badge>
            </IconButton>
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
