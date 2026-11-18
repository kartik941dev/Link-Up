import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.js';

export type WorkspaceTab = '/' | '/graph' | '/arrange' | '/chat';

interface WorkspaceContextType {
  activePath: WorkspaceTab;
  dataVersion: number;
  notifyDataChanged: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const normalizeTab = (pathname: string): WorkspaceTab => {
  if (pathname === '/graph' || pathname === '/arrange' || pathname === '/chat') {
    return pathname;
  }
  return '/';
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [dataVersion, setDataVersion] = useState<number>(0);

  // Reset version cleanly when user changes
  useEffect(() => {
    setDataVersion(0);
  }, [user?.id]);

  const notifyDataChanged = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const activePath = normalizeTab(location.pathname);

  return (
    <WorkspaceContext.Provider value={{ activePath, dataVersion, notifyDataChanged }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    return {
      activePath: '/',
      dataVersion: 0,
      notifyDataChanged: () => {},
    };
  }
  return ctx;
};
