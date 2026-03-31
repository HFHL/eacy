import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectPatientDetail from './pages/ProjectPatientDetail';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import AIProcessing from './pages/AIProcessing';
import Settings from './pages/Settings';
import AdminPage from './pages/AdminPage';
import CrfDesigner from './pages/CrfDesigner';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* 受保护的主布局路由 */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:id/patient/:patientId" element={<ProjectPatientDetail />} />
          <Route path="patients" element={<Patients />} />
          <Route path="patients/:id" element={<PatientDetail />} />
          <Route path="ai" element={<AIProcessing />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="crf-designer" element={<CrfDesigner />} />
          <Route path="crf-designer/:templateId" element={<CrfDesigner />} />
        </Route>

        {/* 兜底路由 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
