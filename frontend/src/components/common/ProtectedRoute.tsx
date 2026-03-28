import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute: React.FC<Props> = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0) {
    const userRole = (user as any)?.role?.toUpperCase();
    if (!roles.includes(userRole)) {
      // Redirect to appropriate dashboard
      const role = userRole?.toLowerCase();
      if (role === 'admin') return <Navigate to="/admin/users" replace />;
      if (role === 'caregiver') return <Navigate to="/caregiver/dashboard" replace />;
      return <Navigate to="/elderly/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
