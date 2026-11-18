import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ChatProvider } from './context/ChatContext.js';
import { WorkspaceProvider } from './context/WorkspaceContext.js';
import { ProtectedRoute } from './components/common/ProtectedRoute.js';
import { WorkspaceShell } from './components/common/WorkspaceShell.js';
import { LoginPage } from './pages/LoginPage.js';
import { SignupPage } from './pages/SignupPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { ResetPasswordPage } from './pages/ResetPasswordPage.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <ChatProvider>
            <Routes>
              {/* Public Authentication Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Single Keep-Alive Protected Workspace Route (guaranteed never to unmount across tab switches) */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <WorkspaceShell />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ChatProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
