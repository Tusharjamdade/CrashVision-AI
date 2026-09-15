import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  AlertTriangle,
  Radio,
  Eye,
  Activity,
  Zap,
  Volume2,
  VolumeX,
  Play,
  Square,
  ShieldCheck,
} from "lucide-react";
import { CardSpotlight } from "../ui/CardSpotlight";
import { EmergencyDispatchModal } from "../dashboard/EmergencyDispatchModal";

export interface LiveMonitoringProps {
  connected: boolean;
  monitoring: boolean;
  demoMode: boolean;
  frame: string | null;
  accident: boolean;
  confidence: number;
  objects: string[];
  recording: boolean;
  processingIncident: boolean;
  fps: number;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
  onStartDemo: () => void;
}

export const LiveMonitoring: React.FC<LiveMonitoringProps> = ({
  connected,
  monitoring,
  demoMode,
  frame,
  accident,
  confidence,
  objects,
  recording,
  processingIncident,
  fps,
  onStartMonitoring,
  onStopMonitoring,
  onStartDemo,
}) => {
  const [audioMuted, setAudioMuted] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  const confidencePct = Math.min(Math.max((confidence || 0) * 100, 0), 100);
  const safeObjects = Array.isArray(objects) ? objects : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Camera className="h-6 w-6 text-blue-400" />
              Live Camera Feed & Vision AI
            </h2>

            {monitoring ? (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                LIVE INFERENCE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-600"}`} />
                {connected ? "FASTAPI CONNECTED" : "OFFLINE / STANDBY"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time YOLOv8 object detection, accident classifier, and automated S3 recording.
          </p>
        </div>

        {/* Quick Stream Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className="rounded-xl border border-white/10 bg-slate-900/60 p-2 text-slate-400 hover:text-white"
            title={audioMuted ? "Unmute Alarm" : "Mute Alarm"}
          >
            {audioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {!monitoring ? (
            <button
              onClick={onStartDemo}
              className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <Zap className="h-4 w-4 text-cyan-400" />
              Launch Demo Stream
            </button>
          ) : null}

          {!monitoring ? (
            <button
              onClick={onStartMonitoring}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" />
              Start Live Feed
            </button>
          ) : (
            <button
              onClick={onStopMonitoring}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              <Square className="h-4 w-4 fill-current" />
              Stop Camera Feed
            </button>
          )}
        </div>
      </div>

      {/* Main Monitoring Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Camera Feed Viewport (8 Columns) */}
        <div className="lg:col-span-8 space-y-4">
          <CardSpotlight
            color={accident ? "rgba(239, 68, 68, 0.25)" : "rgba(59, 130, 246, 0.15)"}
            className={`relative overflow-hidden p-2 transition-all duration-300 ${
              accident ? "border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)]" : ""
            }`}
          >
            {/* Top Camera Header Bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
                <span className="font-mono font-medium">CAM-01 • MAIN INTERSECTION</span>
                {demoMode && (
                  <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300 border border-cyan-500/30">
                    SIMULATED DEMO
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {fps > 0 && (
                  <span className="font-mono text-[10px] text-slate-400">
                    {fps} FPS
                  </span>
                )}
                {recording && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    REC S3
                  </span>
                )}
                {processingIncident && (
                  <span className="text-[10px] font-bold text-amber-400">
                    SAVING INCIDENT...
                  </span>
                )}
              </div>
            </div>

            {/* Video / Frame Screen */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center">
              {frame ? (
                <img
                  src={frame}
                  alt="Live Camera Stream"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-slate-500">
                    <Camera className="h-10 w-10 text-slate-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-300">
                    Camera Feed Offline
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Connect your local Python FastAPI server or click{" "}
                    <strong className="text-cyan-400">"Launch Demo Stream"</strong> above to test full live AI alerts!
                  </p>
                </div>
              )}

              {/* Pulsing Accident Alert Banner */}
              <AnimatePresence>
                {accident && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute left-4 right-4 top-4 flex items-center justify-between rounded-xl border border-red-500/60 bg-red-950/90 px-5 py-3 shadow-2xl backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/30 text-red-400 animate-bounce">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-red-200 uppercase tracking-wider">
                          ⚠️ POTENTIAL ACCIDENT DETECTED
                        </h4>
                        <p className="text-[11px] text-red-300/80">
                          Automatic evidence recording and AI classification triggered.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <span className="text-lg font-extrabold text-red-300">
                          {confidencePct.toFixed(1)}%
                        </span>
                        <p className="text-[9px] text-red-400/80">CONFIDENCE</p>
                      </div>

                      <button
                        onClick={() => setEmergencyModalOpen(true)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-red-500"
                      >
                        Dispatch EMS
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardSpotlight>
        </div>

        {/* Real-time Telemetry & Detections (4 Columns) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Classification Status */}
          <CardSpotlight color={accident ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)"}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Classifier Status
            </h3>

            <div
              className={`rounded-xl border p-4 flex items-center gap-3 ${
                accident
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              <div
                className={`h-3 w-3 rounded-full ${
                  accident ? "bg-red-500 animate-ping" : "bg-emerald-400"
                }`}
              />
              <div>
                <p className="font-bold text-sm">
                  {accident ? "ACCIDENT CRITICAL" : "NORMAL ROAD SCENE"}
                </p>
                <p className="text-[11px] opacity-80">
                  {accident
                    ? "Immediate attention required"
                    : "No incident signatures detected"}
                </p>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Classification Confidence</span>
                <span className="font-mono font-bold text-slate-200">
                  {confidencePct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  className={`h-full rounded-full ${
                    accident ? "bg-red-500" : "bg-blue-500"
                  }`}
                  animate={{ width: `${confidencePct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </CardSpotlight>

          {/* Detected Objects Tags */}
          <CardSpotlight>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-400" />
              Detected Objects ({safeObjects.length})
            </h3>

            {safeObjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {safeObjects.map((obj, i) => (
                  <span
                    key={`${obj}-${i}`}
                    className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-mono font-medium text-cyan-300 shadow-sm"
                  >
                    🏷️ {obj}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono">
                No active objects detected in current frame.
              </p>
            )}
          </CardSpotlight>

          {/* Emergency Hotline Button */}
          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/60 to-slate-950 p-4 text-xs font-bold text-red-300 shadow-xl transition hover:border-red-500/60 hover:bg-red-950/80 active:scale-98"
          >
            <ShieldCheck className="h-5 w-5 text-red-400" />
            OPEN EMERGENCY DISPATCH HUB
          </button>
        </div>
      </div>

      {/* Emergency Modal */}
      <EmergencyDispatchModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
      />
    </div>
  );
};
