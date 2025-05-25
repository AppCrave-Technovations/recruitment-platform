import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Login from './components/auth/Login';
import SystemAdminDashboard from './components/admin/SystemAdminDashboard';
import ClientAdminDashboard from './components/admin/ClientAdminDashboard';
import RecruiterDashboard from './components/recruiter/RecruiterDashboard';
import PrivateRoute from './components/common/PrivateRoute';
import Header from './components/common/Header';
import './styles/global.css';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <div className="app">
            <Header />
            <main className="main-content">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                <Route
                  path="/dashboard"
                  element={
                    <PrivateRoute>
                      <DashboardRouter />
                    </PrivateRoute>
                  }
                />
              </Routes>
            </main>
          </div>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

function DashboardRouter() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'system_admin':
      return <SystemAdminDashboard />;
    case 'client_admin':
      return <ClientAdminDashboard />;
    case 'recruiter':
      return <RecruiterDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default App;