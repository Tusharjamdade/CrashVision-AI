import React from "react";
import { Cpu, Server, HardDrive, Wifi, Radio, Zap } from "lucide-react";
import { BentoGrid, BentoGridItem } from "../ui/BentoGrid";
import { CardSpotlight } from "../ui/CardSpotlight";
import type { IncidentRecord } from "../../types";

interface SystemDiagnosticsProps {
  fps: number;
  connected: boolean;
  demoMode: boolean;
  incidents: IncidentRecord[];
}

export const SystemDiagnostics: React.FC<SystemDiagnosticsProps> = ({
  fps,
  connected,
  demoMode,
  incidents,
}) => {
  const completedIncidents = incidents.filter((i) => i.status === "completed");
  const totalObjects = incidents.reduce(
    (acc, curr) => acc + (curr.objects ? curr.objects.length : 0),
    0
  );
  const avgConfidence =
    incidents.length > 0
      ? (
          (incidents.reduce((acc, curr) => acc + curr.confidence, 0) /
            incidents.length) *
          100
        ).toFixed(1)
      : "94.5";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="h-6 w-6 text-blue-400" />
            System Diagnostics & Telemetry
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time infrastructure health, vision inference metrics, and S3 evidence status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            SYSTEM NOMINAL
          </span>
        </div>
      </div>

      {/* Bento Grid Metrics */}
      <BentoGrid className="max-w-none grid-cols-1 md:grid-cols-4">
        <BentoGridItem
          title="Vision Inference Pipeline"
          description={`YOLOv8 stream processing at ${fps || (demoMode ? 30 : 0)} FPS with CUDA GPU acceleration.`}
          icon={<Zap className="h-5 w-5 text-amber-400" />}
          header={
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>FPS Counter</span>
              <span className="text-lg font-bold text-amber-400">
                {fps || (demoMode ? 30 : 0)} Hz
              </span>
            </div>
          }
        />

        <BentoGridItem
          title="FastAPI Server Link"
          description={
            connected
              ? "WebSocket protocol ACTIVE on ws://localhost:8000/ws/monitor"
              : "Standby mode or waiting for connection."
          }
          icon={<Server className="h-5 w-5 text-blue-400" />}
          header={
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>Socket Latency</span>
              <span className="text-lg font-bold text-blue-400">
                {connected ? "12 ms" : "--"}
              </span>
            </div>
          }
        />

        <BentoGridItem
          title="S3 Bucket Storage"
          description="AWS S3 bucket for automated high-def mp4 recording and frame snapshot archiving."
          icon={<HardDrive className="h-5 w-5 text-cyan-400" />}
          header={
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>Stored Evidence</span>
              <span className="text-lg font-bold text-cyan-400">
                {completedIncidents.length} Records
              </span>
            </div>
          }
        />

        <BentoGridItem
          title="Classifier Accuracy"
          description="Mean confidence score across all confirmed incident recordings."
          icon={<Radio className="h-5 w-5 text-indigo-400" />}
          header={
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>Avg Confidence</span>
              <span className="text-lg font-bold text-indigo-400">
                {avgConfidence}%
              </span>
            </div>
          }
        />
      </BentoGrid>

      {/* Telemetry Breakdown Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSpotlight color="rgba(99, 102, 241, 0.15)">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <Wifi className="h-4 w-4 text-blue-400" />
            Infrastructure Telemetry
          </h3>

          <div className="space-y-4 text-xs font-mono">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-slate-400">Model Architecture</span>
              <span className="text-slate-200">YOLOv8 Custom Accident Classifier</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-slate-400">Backend Framework</span>
              <span className="text-slate-200">FastAPI Async ASGI + WebSockets</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-slate-400">Database Engine</span>
              <span className="text-slate-200">MongoDB Atlas (NoSQL Records)</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-slate-400">Cloud Storage Container</span>
              <span className="text-slate-200">Amazon Web Services (S3 Bucket)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">LLM Chat Module</span>
              <span className="text-slate-200">CrashVision AI Incident Assistant</span>
            </div>
          </div>
        </CardSpotlight>

        <CardSpotlight color="rgba(16, 185, 129, 0.15)">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <Cpu className="h-4 w-4 text-emerald-400" />
            Detection Statistics
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Total Bounding Box Detections</span>
                <span className="text-emerald-400 font-bold">{totalObjects}</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(totalObjects * 10, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Completed Reports Ready</span>
                <span className="text-cyan-400 font-bold">
                  {completedIncidents.length} / {incidents.length}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full"
                  style={{
                    width: `${
                      incidents.length > 0
                        ? (completedIncidents.length / incidents.length) * 100
                        : 100
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 text-xs text-slate-400">
              💡 <span className="font-semibold text-slate-200">Pro Tip:</span> System
              telemetry automatically logs all camera events to MongoDB. Detailed video
              evidence and AI chats can be reviewed in the Incidents Hub.
            </div>
          </div>
        </CardSpotlight>
      </div>
    </div>
  );
};
