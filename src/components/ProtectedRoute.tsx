import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: Array<'admin' | 'eco_auditor' | 'reviewer' | 'client_viewer'>;
}

export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, loading, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // If specific roles are required, check them
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequired = requiredRoles.some(r => roles.includes(r));
    if (!hasRequired && roles.length > 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-1">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
