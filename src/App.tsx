
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { PendingApproval } from './pages/PendingApproval';
import { LiteDashboard } from './pages/LiteDashboard';
import { ProDashboard } from './pages/ProDashboard';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = () => {
  const { currentUser, loading, firebaseUser } = useAuth();
  console.log("ProtectedRoute check:", { loading, hasFirebaseUser: !!firebaseUser, hasCurrentUser: !!currentUser, isApproved: currentUser?.isApproved });

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-brand-blue" /></div>;
  }

  // Not logged in at all -> Login
  if (!firebaseUser) {
    return <Navigate to="/login" />;
  }

  // Logged in (Firebase), but no Profile (Firestore) yet
  // This might happen if 'loading' finished but profile fetch failed or is delayed/empty
  // Ideally AuthContext 'loading' covers this, but if we have firebaseUser and no currentUser, we are in an intermediate state.
  if (!currentUser) {
    // Safety fallback: still loading profile or profile missing
    return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-brand-blue" /></div>;
  }

  if (!currentUser.isApproved) {
    return <Navigate to="/pending" />;
  }

  return <Outlet />;
};

const PublicRoute = () => {
  const { firebaseUser, loading } = useAuth();
  if (!loading && firebaseUser) {
    return <Navigate to="/" />;
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
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

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
