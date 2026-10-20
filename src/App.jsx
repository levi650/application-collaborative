import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import GradesPage from './pages/GradesPage.jsx';

/**
 * ForbiddenPage – displayed when a user accesses a route they are not authorized for.
 */
function ForbiddenPage() {
  return (
    <div className="forbidden-page">
      <h1>403</h1>
      <h2>Accès interdit</h2>
      <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
      <Link to="/grades" className="btn btn-primary">Retour aux notes</Link>
    </div>
  );
}

/**
 * App – root component with routing and auth provider.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route
            path="/grades"
            element={
              <ProtectedRoute>
                <GradesPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/grades" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
