import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { PrefsProvider } from './contexts/PrefsContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { DeskProvider } from './contexts/DeskContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { SnapshotProvider } from './contexts/SnapshotContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AppShell } from './components/AppShell';
import { Home } from './pages/Home';
import { Chat } from './pages/Chat';
import { MultiBoard } from './pages/MultiBoard';
import { GroupChat } from './pages/GroupChat';
import { Office } from './pages/Office';
import { Inbox } from './pages/Inbox';
import { Channels } from './pages/Channels';
import { Tasks } from './pages/Tasks';
import { Todos } from './pages/Todos';
import { Calendar } from './pages/Calendar';
import { Agents } from './pages/Agents';
import { AgentDetail } from './pages/AgentDetail';
import { Permissions } from './pages/Permissions';
import { VirtualComputer } from './pages/VirtualComputer';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { SettingsHub } from './pages/settings/SettingsHub';
import { SettingsGeneral } from './pages/settings/SettingsGeneral';
import { SettingsTheme } from './pages/settings/SettingsTheme';
import { SettingsConnections } from './pages/settings/SettingsConnections';
import { SettingsVoice } from './pages/settings/SettingsVoice';
import { SettingsModelBrowser } from './pages/settings/SettingsModelBrowser';
import { SettingsHardware, SettingsNetwork } from './pages/settings/SettingsSystem';
import { SettingsLock, SettingsPerformance, SettingsWidgets } from './pages/settings/SettingsDisplay';
import { SettingsNavigation } from './pages/settings/SettingsNavigation';
import { SettingsNotifications, SettingsSafety, SettingsShortcuts } from './pages/settings/SettingsSafety';
import { SettingsLogsRecycle } from './pages/settings/SettingsLogsRecycle';
import { SettingsPro } from './pages/settings/SettingsPro';
import { SettingsSkills } from './pages/settings/SettingsSkills';
import { SettingsAudits } from './pages/settings/SettingsAudits';
import { SettingsModules } from './pages/settings/SettingsModules';
import { SettingsCompanyTraining } from './pages/settings/SettingsCompanyTraining';
import { SettingsCompanyOps } from './pages/settings/SettingsCompanyOps';
import { Lessons } from './pages/Lessons';
import { Lock } from './pages/Lock';
import { Arcade, ArcadeGame } from './pages/Arcade';
import { FilesPage } from './pages/Files';
import { Onboarding } from './components/Onboarding';
import { ProProvider } from './contexts/ProContext';
import { AgentsProvider } from './contexts/AgentsContext';

interface AppProps {
  initialMode?: 'super' | 'multi' | 'pro';
  theme?: 'light' | 'dark';
  deskModule?: boolean;
  firstLaunch?: boolean;
}

function SettingsKeysRedirect() {
  const [searchParams] = useSearchParams();
  const provider = searchParams.get('provider');
  const query = provider ? `?provider=${encodeURIComponent(provider)}` : '';
  return <Navigate to={`/settings/connections${query}#keys`} replace />;
}

export function App({ initialMode = 'multi', theme = 'light', deskModule = true, firstLaunch = true }: AppProps) {
  return (
    <MotionConfig reducedMotion="user">
      <PrefsProvider key={theme} initialTheme={theme}>
        <SettingsProvider key={String(firstLaunch)} firstLaunch={firstLaunch}>
          <NotificationProvider>
          <AgentsProvider>
          <DeskProvider key={`${initialMode}-${deskModule}`} initialMode={initialMode} initialDesk={deskModule}>
            <ProfileProvider>
            <SnapshotProvider>
              <ProProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/chat" element={<Navigate to="/chat/chief" replace />} />
                    <Route path="/chat/:threadId" element={<Chat />} />
                    <Route path="/board" element={<MultiBoard />} />
                    <Route path="/group" element={<GroupChat />} />
                    <Route path="/group/:groupId" element={<GroupChat />} />
                    <Route path="/office" element={<Office />} />
                    <Route path="/live" element={<Navigate to="/group" replace />} />
                    <Route path="/inbox" element={<Inbox />} />
                    <Route path="/channels" element={<Channels />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/lessons" element={<Navigate to="/settings/lessons" replace />} />
                    <Route path="/todos" element={<Todos />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/agents" element={<Agents />} />
                    <Route path="/agents/:id" element={<AgentDetail />} />
                    <Route path="/permissions" element={<Navigate to="/settings/permissions" replace />} />
                    <Route path="/lock" element={<Lock />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/desk" element={<VirtualComputer />} />
                    <Route path="/files" element={<FilesPage />} />
                    <Route path="/arcade" element={<Arcade />} />
                    <Route path="/arcade/:gameId" element={<ArcadeGame />} />
                    <Route path="/models" element={<Navigate to="/settings/models" replace />} />
                    <Route path="/settings" element={<SettingsLayout />}>
                      <Route index element={<SettingsHub />} />
                      <Route path="general" element={<SettingsGeneral />} />
                      <Route path="theme" element={<SettingsTheme />} />
                      <Route path="connections" element={<SettingsConnections />} />
                      <Route path="modules" element={<SettingsModules />} />
                      {/* Legacy aliases — keep old Connections / API routes working */}
                      <Route path="providers" element={<Navigate to="/settings/connections#providers" replace />} />
                      <Route path="keys" element={<SettingsKeysRedirect />} />
                      <Route path="apis" element={<Navigate to="/settings/connections#apis" replace />} />
                      <Route path="voice" element={<SettingsVoice />} />
                      <Route path="models" element={<SettingsModelBrowser />} />
                      <Route path="pro" element={<SettingsPro />} />
                      <Route path="skills" element={<SettingsSkills />} />
                      <Route
                        path="company"
                        element={
                          <>
                            <SettingsCompanyTraining />
                            <SettingsCompanyOps />
                          </>
                        }
                      />
                      <Route path="lessons" element={<Lessons embedded />} />
                      <Route path="permissions" element={<Permissions embedded />} />
                      <Route path="audits" element={<SettingsAudits />} />
                      <Route path="hardware" element={<SettingsHardware />} />
                      <Route path="network" element={<SettingsNetwork />} />
                      <Route path="widgets" element={<SettingsWidgets />} />
                      <Route path="navigation" element={<SettingsNavigation />} />
                      <Route path="performance" element={<SettingsPerformance />} />
                      <Route path="lock" element={<SettingsLock />} />
                      <Route path="safety" element={<SettingsSafety />} />
                      <Route path="logs" element={<SettingsLogsRecycle />} />
                      <Route path="notifications" element={<SettingsNotifications />} />
                      <Route path="shortcuts" element={<SettingsShortcuts />} />
                    </Route>
                    <Route path="*" element={<Home />} />
                  </Route>
                </Routes>
              </BrowserRouter>
              </ProProvider>
            </SnapshotProvider>
            </ProfileProvider>
          </DeskProvider>
          </AgentsProvider>
          </NotificationProvider>
        </SettingsProvider>
      </PrefsProvider>
    </MotionConfig>);

}