import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace, WorkspaceTab } from '../../context/WorkspaceContext.js';
import { HomePage } from '../../pages/HomePage.js';
import { GraphPage } from '../../pages/GraphPage.js';
import { SmartArrangePage } from '../../pages/SmartArrangePage.js';
import { ChatPage } from '../../pages/ChatPage.js';

/**
 * Keep-Alive Workspace Shell:
 * Lazily mounts each workspace tab on first visit and keeps it mounted in memory
 * when switching between Canvas, Knowledge Graph, Smart Arrange, and AI Assistant.
 * Keyed by user.id so signing out or switching accounts cleanly resets all pages.
 */
const KeepAliveTabs: React.FC = () => {
  const { activePath } = useWorkspace();
  const [visited, setVisited] = useState<Record<WorkspaceTab, boolean>>({
    '/': activePath === '/',
    '/graph': activePath === '/graph',
    '/arrange': activePath === '/arrange',
    '/chat': activePath === '/chat',
  });

  useEffect(() => {
    setVisited((prev) => {
      if (prev[activePath]) return prev;
      return { ...prev, [activePath]: true };
    });
  }, [activePath]);

  return (
    <>
      {visited['/'] && (
        <div style={{ display: activePath === '/' ? 'block' : 'none' }}>
          <HomePage />
        </div>
      )}
      {visited['/graph'] && (
        <div style={{ display: activePath === '/graph' ? 'block' : 'none' }}>
          <GraphPage />
        </div>
      )}
      {visited['/arrange'] && (
        <div style={{ display: activePath === '/arrange' ? 'block' : 'none' }}>
          <SmartArrangePage />
        </div>
      )}
      {visited['/chat'] && (
        <div style={{ display: activePath === '/chat' ? 'block' : 'none' }}>
          <ChatPage />
        </div>
      )}
    </>
  );
};

export const WorkspaceShell: React.FC = () => {
  const { user } = useAuth();
  return <KeepAliveTabs key={user?.id || 'guest'} />;
};
