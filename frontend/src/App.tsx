import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './hooks';
import { fetchProfile } from './features/auth/authSlice';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import RunsPage from './pages/RunsPage';
import RunDetailPage from './pages/RunDetailPage';
import SettingsPage from './pages/SettingsPage';
import PricingPage from './pages/PricingPage';
import RequirementsPage from './pages/RequirementsPage';
import TestPlansPage from './pages/TestPlansPage';
import TestPlanDetailPage from './pages/TestPlanDetailPage';
import ScenariosPage from './pages/ScenariosPage';
import ScenarioDetailPage from './pages/ScenarioDetailPage';
import ApprovalsPage from './pages/ApprovalsPage';
import GeneratedTestsPage from './pages/GeneratedTestsPage';
import HealingPage from './pages/HealingPage';
import CoveragePage from './pages/CoveragePage';
import OrganizationsPage from './pages/OrganizationsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAppSelector(s => s.auth.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAppSelector(s => s.auth.accessToken);
  return !token ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

export default function App() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(s => s.auth.accessToken);

  useEffect(() => {
    if (token) dispatch(fetchProfile());
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login"   element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="requirements" element={<RequirementsPage />} />
          <Route path="test-plans" element={<TestPlansPage />} />
          <Route path="test-plans/:id" element={<TestPlanDetailPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="scenarios/:id" element={<ScenarioDetailPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="generated" element={<GeneratedTestsPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="runs/:id" element={<RunDetailPage />} />
          <Route path="healing" element={<HealingPage />} />
          <Route path="coverage" element={<CoveragePage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
