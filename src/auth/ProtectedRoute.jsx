import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';

/**
 * ProtectedRoute – guards routes by authentication and optionally by role.
 * @param {{ allowedRoles?: string[], children: React.ReactNode }} props
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-state">
        <span className="spinner lg" />
        <span>Chargement…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
