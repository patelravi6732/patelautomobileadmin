import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ScrollToTop from './components/ScrollToTop';

// Public Layout & Pages
import PublicLayout from './components/PublicLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ContactPage from './pages/ContactPage';
import BookServicePage from './pages/BookServicePage';

// Auth Page
import LoginPage from './pages/LoginPage';

// Internal Dashboard Layout & Pages
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import BookingsPage from './pages/BookingsPage';
import MessagesPage from './pages/MessagesPage';
import NewServicePage from './pages/NewServicePage';
import WorkshopPage from './pages/WorkshopPage';
import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import VehicleHistoryPage from './pages/VehicleHistoryPage';
import BillingPage from './pages/BillingPage';
import CounterSalePage from './pages/CounterSalePage';
import KhataBookPage from './pages/KhataBookPage';
import AttendancePage from './pages/AttendancePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import RecycleBinPage from './pages/RecycleBinPage';

// ================================================================
// CONFIGURABLE SECRET ADMIN LOGIN ROUTE PATH
// Change this variable string to customize your secret admin URL!
// Currently set to: "/patel-admin-portal" (also accepts "/login")
// ================================================================
export const SECRET_ADMIN_LOGIN_PATH = "/patel-admin-portal";

// Protected Route Guard (Admin Only)
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-400 font-medium">Verifying Admin Session...</div>;
  const isLoggedIn = (
    localStorage.getItem('admin_logged_in') === 'true' || 
    sessionStorage.getItem('admin_logged_in') === 'true' || 
    Boolean(user)
  );
  if (!isLoggedIn) return <Navigate to={SECRET_ADMIN_LOGIN_PATH} replace />;
  return children;
};

export default function App() {
  React.useEffect(() => {
    const CURRENT_VERSION = 'patel_v2.5.0_permanent_cloud';
    const lastVersion = localStorage.getItem('app_build_version');
    if (lastVersion !== CURRENT_VERSION) {
      localStorage.setItem('app_build_version', CURRENT_VERSION);
    }
  }, []);

  return (
    <AuthProvider>
      <ScrollToTop />
        <Routes>
          {/* DEFAULT ROOT REDIRECT TO ADMIN PORTAL */}
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

          {/* SECRET ADMIN LOGIN SYSTEM ROUTES */}
          <Route path={SECRET_ADMIN_LOGIN_PATH} element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* GARAGE MANAGEMENT SAAS DASHBOARD ROUTES (Supports both /app/* and /admin/*) */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="new-service" element={<NewServicePage />} />
            <Route path="workshop" element={<WorkshopPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="counter-sale" element={<CounterSalePage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="khata-book" element={<KhataBookPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="recycle-bin" element={<RecycleBinPage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="new-service" element={<NewServicePage />} />
            <Route path="workshop" element={<WorkshopPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="counter-sale" element={<CounterSalePage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="khata-book" element={<KhataBookPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="recycle-bin" element={<RecycleBinPage />} />
          </Route>

        {/* CATCH ALL REDIRECT */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AuthProvider>
  );
}
