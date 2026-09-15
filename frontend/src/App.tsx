import { useState } from "react";
import { BackgroundBeams } from "./components/ui/BackgroundBeams";
import { FloatingNav } from "./components/ui/FloatingNav";
import { HeroSection } from "./components/home/HeroSection";
import { LiveMonitoring } from "./components/monitor/LiveMonitoring";
import { IncidentList } from "./components/incidents/IncidentList";
import { IncidentDetails } from "./components/incidents/IncidentDetails";
import { SystemDiagnostics } from "./components/dashboard/SystemDiagnostics";
import { AuthModal } from "./components/auth/AuthModal";

import { useWebSocketMonitor } from "./hooks/useWebSocketMonitor";
import { useIncidents } from "./hooks/useIncidents";
import { useIncidentChat } from "./hooks/useIncidentChat";
import { useAuth } from "./hooks/useAuth";
import type { Page } from "./types";

export default function App() {
  const [activePage, setActivePage] = useState<Page>("home");

  // Custom Hooks for State Management, Auth & Offline Resilience
  const auth = useAuth();
  const monitor = useWebSocketMonitor();
  const incidentsState = useIncidents();
  const chatState = useIncidentChat(incidentsState.selectedIncident);

  return (
    <div className="relative min-h-screen bg-[#030712] text-slate-100 selection:bg-blue-600 selection:text-white font-sans">
      {/* Aceternity Glowing Background Beams & Grid */}
      <BackgroundBeams />

      {/* Main Content Container */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Floating Glass Top Dock Navigation */}
        <FloatingNav
          activePage={activePage}
          setActivePage={(page) => {
            setActivePage(page);
            if (page !== "incidents") {
              incidentsState.setSelectedIncident(null);
            }
          }}
          connected={monitor.connected}
          monitoring={monitor.monitoring}
          onStartMonitoring={monitor.startMonitoring}
          onStopMonitoring={monitor.stopMonitoring}
          onStartDemo={monitor.startDemoMode}
          demoMode={monitor.demoMode}
          user={auth.user}
          onOpenAuth={() => auth.setIsAuthModalOpen(true)}
          onLogout={auth.logout}
        />

        {/* Auth Modal */}
        <AuthModal
          isOpen={auth.isAuthModalOpen}
          onClose={() => auth.setIsAuthModalOpen(false)}
          onLogin={auth.login}
          onRegister={auth.register}
        />

        {/* Page Content Viewports */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Home / Hero Page */}
          {activePage === "home" && (
            <HeroSection
              onNavigate={(page) => {
                setActivePage(page);
                if (page !== "incidents") {
                  incidentsState.setSelectedIncident(null);
                }
              }}
              onStartDemo={monitor.startDemoMode}
              onOpenAuth={() => auth.setIsAuthModalOpen(true)}
              isLoggedIn={!!auth.user}
              userName={auth.user?.full_name || auth.user?.username}
            />
          )}

          {/* Live Monitoring Page */}
          {activePage === "monitor" && (
            <LiveMonitoring
              connected={monitor.connected}
              monitoring={monitor.monitoring}
              demoMode={monitor.demoMode}
              frame={monitor.frame}
              accident={monitor.accident}
              confidence={monitor.confidence}
              objects={monitor.objects}
              recording={monitor.recording}
              processingIncident={monitor.processingIncident}
              fps={monitor.fps}
              onStartMonitoring={monitor.startMonitoring}
              onStopMonitoring={monitor.stopMonitoring}
              onStartDemo={monitor.startDemoMode}
            />
          )}

          {/* Incidents Hub & Details */}
          {activePage === "incidents" && (
            incidentsState.selectedIncident ? (
              <IncidentDetails
                incident={incidentsState.selectedIncident}
                messages={chatState.messages}
                chatInput={chatState.chatInput}
                chatLoading={chatState.chatLoading}
                chatError={chatState.chatError}
                conversationId={chatState.conversationId}
                onBack={() => {
                  incidentsState.setSelectedIncident(null);
                  chatState.clearChat();
                }}
                onRefresh={incidentsState.loadIncidents}
                onChatInputChange={chatState.setChatInput}
                onSendMessage={chatState.sendMessage}
              />
            ) : (
              <IncidentList
                incidents={incidentsState.incidents}
                allIncidentsCount={incidentsState.rawIncidents.length}
                loading={incidentsState.loading}
                error={incidentsState.error}
                filters={incidentsState.filters}
                allTags={incidentsState.allTags}
                setFilters={incidentsState.setFilters}
                onRefresh={incidentsState.loadIncidents}
                onOpen={incidentsState.openIncident}
              />
            )
          )}

          {/* System Diagnostics Page */}
          {activePage === "diagnostics" && (
            <SystemDiagnostics
              fps={monitor.fps}
              connected={monitor.connected}
              demoMode={monitor.demoMode}
              incidents={incidentsState.rawIncidents}
            />
          )}
        </main>

        {/* Cyberpunk Footer */}
        <footer className="relative z-10 border-t border-white/5 py-4 text-center text-xs text-slate-500 font-mono">
          <p>CrashVision AI • YOLOv8 Computer Vision Safeguard • Aceternity UI</p>
        </footer>
      </div>
    </div>
  );
}
