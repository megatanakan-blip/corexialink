
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { PendingApproval } from './pages/PendingApproval';
import { LiteDashboard } from './pages/LiteDashboard';
import { ProDashboard } from './pages/ProDashboard';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = () => {
  const { currentUser, loading, firebaseUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-brand-blue" /></div>;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!currentUser) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-brand-blue" /></div>;
  }

  if (!currentUser.isApproved) {
    return <Navigate to="/pending" replace />;
  }

  return <Outlet />;
};

const HomeRedirect = () => {
  const { currentUser } = useAuth();

  if (currentUser?.role === 'pro') {
    return <Navigate to="/pro" replace />;
  }

  return <Navigate to="/lite" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public pages - no guards to avoid race conditions during signup */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/pending" element={<PendingApproval />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/lite" element={<LiteDashboard />} />
            <Route path="/pro" element={<ProDashboard />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
