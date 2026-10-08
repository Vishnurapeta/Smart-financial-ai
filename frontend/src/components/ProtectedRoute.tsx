import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { RoleName } from '../types/auth.ts';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  requiredRole?: RoleName;
  allowedRoles?: RoleName[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRole,
  allowedRoles,
  children,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-slate-400 text-sm">Verifying secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isRoleAuthorized = () => {
    if (allowedRoles && allowedRoles.length > 0) {
      return !!(user && allowedRoles.includes(user.role));
    }
    if (requiredRole) {
      return user?.role === requiredRole;
    }
    return true;
  };

  if (!isRoleAuthorized()) {
    const rolesRequiredText = allowedRoles ? allowedRoles.join(', ') : requiredRole;
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">403 — Privileged Access Denied</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your current role (<span className="text-emerald-400 font-semibold">{user?.role}</span>)
            does not have permission to view this resource. Requires role in [
            <span className="text-rose-400 font-semibold">{rolesRequiredText}</span>].
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Return to Safety
          </a>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
