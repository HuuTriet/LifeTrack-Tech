import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// Layouts
import ElderlyLayout from './layouts/ElderlyLayout';
import CaregiverLayout from './layouts/CaregiverLayout';
import AdminLayout from './layouts/AdminLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Elderly Pages
import ElderlyDashboard from './pages/elderly/ElderlyDashboard';
import HealthTrackingPage from './pages/elderly/HealthTrackingPage';
import MedicationSchedulePage from './pages/elderly/MedicationSchedulePage';
import AppointmentPage from './pages/elderly/AppointmentPage';
import ActivityPage from './pages/elderly/ActivityPage';
import EmailNotificationSettingsPage from './pages/elderly/EmailNotificationSettingsPage';
// Caregiver Pages
import CaregiverDashboard from './pages/caregiver/CaregiverDashboard';
import AddMedicationPage from './pages/caregiver/AddMedicationPage';
import HealthTrendsPage from './pages/caregiver/HealthTrendsPage';
import ElderlyProfilePage from './pages/caregiver/ElderlyProfilePage';
import ElderlyDetailPage from './pages/caregiver/ElderlyDetailPage';

// Shared Pages
import ProfilePage from './pages/shared/ProfilePage';
import NotificationsPage from './pages/shared/NotificationsPage';
import HelpPage from './pages/shared/HelpPage';

// Admin Pages
import AdminUsersPage from './pages/admin/AdminUsersPage';

// Guards
import ProtectedRoute from './components/common/ProtectedRoute';

// Store
import { useAuthStore } from './store/authStore';

// ---- MUI Theme (WCAG 2.1 compliant) ----
const theme = createTheme({
  palette: {
    primary: { main: '#2E5C7F', light: '#4A8FB8', dark: '#1A3D5C' },
    secondary: { main: '#E88D5D', light: '#F4C8A6', dark: '#C0532A' },
    success: { main: '#52B788' },
    warning: { main: '#F4A261' },
    error: { main: '#E76F51' },
    background: { default: '#FAF8F5', paper: '#FFFFFF' },
    text: { primary: '#2C3E50', secondary: '#7A8B99' },
  },
  typography: {
    fontFamily: "'Be Vietnam Pro', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 16,
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.7 },
    body2: { fontSize: '0.9rem', lineHeight: 1.6 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
  },
});

/**
 * AppRoutes is a separate component so it can consume the auth store
 * (hooks must be called inside the React tree, not at module level).
 */
const AppRoutes: React.FC = () => {
  const getElderlyId = useAuthStore((s) => s.getElderlyId);

  // Resolved at render time — will be the authenticated user's elderlyId
  // or the caregiver's currently selected patient. Falls back to empty
  // string so typed props (string, not string|null) remain valid while
  // rendering placeholder routes before the user logs in.
  const elderlyId = getElderlyId() ?? '';

  return (
    <Routes>
      {/* ── Public Routes ──────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* ── Default redirect ───────────────────────────────── */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ── Elderly Routes ─────────────────────────────────── */}
      <Route
        path="/elderly"
        element={
          <ProtectedRoute roles={['ELDERLY']}>
            <ElderlyLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ElderlyDashboard />} />
        <Route
          path="health-check"
          element={<HealthTrackingPage elderlyId={elderlyId} />}
        />
        <Route path="medications" element={<MedicationSchedulePage />} />
        <Route path="appointments" element={<AppointmentPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="email-notifications" element={<EmailNotificationSettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>

      {/* ── Caregiver Routes ───────────────────────────────── */}
      <Route
        path="/caregiver"
        element={
          <ProtectedRoute roles={['CAREGIVER']}>
            <CaregiverLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CaregiverDashboard />} />
        <Route path="elderly" element={<ElderlyProfilePage />} />
        <Route path="elderly/:id" element={<ElderlyDetailPage />} />
        <Route path="medications/add" element={<AddMedicationPage />} />
        <Route
          path="health-trends"
          element={<HealthTrendsPage elderlyId={elderlyId} />}
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>

      {/* ── Admin Routes ───────────────────────────────────── */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>

      {/* ── Fallback ────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
