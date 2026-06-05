import React from 'react';
import { useAuthContext } from '@/lib/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles }) => {
  const { user, loading } = useAuthContext();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please login to continue</div>;
  }

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <div className="flex items-center justify-center h-screen">Access Denied</div>;
  }

  return <>{children}</>;
};
