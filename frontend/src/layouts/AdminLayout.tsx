import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
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
import {
  Dashboard,
  People,
  Notifications,
  Help,
  Menu,
  Logout,
  AdminPanelSettings,
  HealthAndSafety,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { label: 'User Management', icon: <People />, path: '/admin/users' },
  { label: 'Notifications', icon: <Notifications />, path: '/admin/notifications' },
  { label: 'Help & Guide', icon: <Help />, path: '/admin/help' },
];

const AdminLayout: React.FC = () => {
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
      <Box
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #1A3D5C 0%, #2E5C7F 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <HealthAndSafety sx={{ color: 'white', fontSize: 32 }} />
        <Box>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, lineHeight: 1.2 }}>
            LifeTrack Tech
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Admin Panel
          </Typography>
        </Box>
      </Box>

      <List sx={{ px: 1.5, pt: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                sx={{
                  borderRadius: '12px',
                  bgcolor: active ? '#EBF4FB' : 'transparent',
                  color: active ? '#2E5C7F' : '#7A8B99',
                  '&:hover': { bgcolor: '#EBF4FB', color: '#2E5C7F' },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: '0.95rem' }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'error.main', width: 38, height: 38 }}>
          <AdminPanelSettings fontSize="small" />
        </Avatar>
        <Box flex={1}>
          <Typography variant="body2" fontWeight={600}>
            {(user as any)?.fullName || user?.name || 'Admin'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            System Administrator
          </Typography>
        </Box>
        <Tooltip title="Logout">
          <IconButton size="small" onClick={handleLogout}>
            <Logout sx={{ color: '#E76F51', fontSize: '1.2rem' }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F4F6F9' }}>
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

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {drawer}
      </Drawer>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: '#FFFFFF', borderBottom: '1px solid #E8F0F7', color: '#2C3E50' }}
        >
          <Toolbar>
            <IconButton sx={{ mr: 2, display: { md: 'none' } }} onClick={() => setMobileOpen(true)}>
              <Menu />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, color: '#2E5C7F' }}>
              {NAV_ITEMS.find((n) => location.pathname.startsWith(n.path))?.label || 'Admin Panel'}
            </Typography>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
