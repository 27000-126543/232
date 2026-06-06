import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import LockerList from '@/pages/LockerList';
import LockerDetail from '@/pages/LockerDetail';
import Alerts from '@/pages/Alerts';
import Approvals from '@/pages/Approvals';
import Forecast from '@/pages/Forecast';
import Reports from '@/pages/Reports';
import ReportDetail from '@/pages/ReportDetail';
import UserManagement from '@/pages/UserManagement';
import { useAuthStore } from '@/store/authStore';

export default function App() {
  const { fetchCurrentUser, isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (token && isAuthenticated) {
      fetchCurrentUser();
    }
  }, [token, isAuthenticated, fetchCurrentUser]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="lockers" element={<LockerList />} />
          <Route path="locker/:id" element={<LockerDetail />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/:id" element={<ReportDetail />} />
          <Route path="admin/users" element={<UserManagement />} />
          <Route path="admin/roles" element={<UserManagement />} />
        </Route>
      </Routes>
    </Router>
  );
}
