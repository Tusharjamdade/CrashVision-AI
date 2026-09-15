import React, { useState } from "react";
import confetti from "canvas-confetti";
import { PhoneCall, ShieldAlert, X, CheckCircle2, AlertOctagon } from "lucide-react";

interface EmergencyDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId?: string;
}

export const EmergencyDispatchModal: React.FC<EmergencyDispatchModalProps> = ({
  isOpen,
  onClose,
  incidentId,
}) => {
  const [dispatchState, setDispatchState] = useState<
    "idle" | "dispatching" | "dispatched"
  >("idle");

  if (!isOpen) return null;

  const handleTriggerDispatch = () => {
    setDispatchState("dispatching");
    setTimeout(() => {
      setDispatchState("dispatched");
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ef4444", "#3b82f6", "#10b981"],
      });
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-slate-950 p-6 shadow-2xl shadow-red-950/50">
        {/* Glow Header */}
        <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-red-600/20 blur-3xl" />

        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-red-400">
            <ShieldAlert className="h-5 w-5 animate-pulse" />
            <h3 className="font-bold tracking-tight text-white text-base">
              Emergency Dispatch Center
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          {incidentId && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 shrink-0 text-red-400" />
              <span>
                Target Incident: <strong className="font-mono">{incidentId}</strong>
              </span>
            </div>
          )}

          <p className="text-xs text-slate-300 leading-relaxed">
            Simulate an automated high-priority emergency dispatch signal to regional EMS,
            traffic control, and highway patrol units.
          </p>

          <div className="rounded-xl border border-white/5 bg-slate-900/80 p-4 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Hotline Node:</span>
              <span className="text-white">911 CAD Dispatch Integration</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>GPS Coordinates:</span>
              <span className="text-emerald-400">37.7749° N, 122.4194° W</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Media Attachments:</span>
              <span className="text-cyan-400">S3 Video & Photo Links Included</span>
            </div>
          </div>

          {dispatchState === "dispatched" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto animate-bounce" />
              <p className="text-sm font-bold text-emerald-300">
                DISPATCH SIGNAL CONFIRMED!
              </p>
              <p className="text-xs text-slate-300">
                Emergency services notified. ETA 4-6 minutes.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
          >
            Cancel
          </button>

          {dispatchState !== "dispatched" && (
            <button
              onClick={handleTriggerDispatch}
              disabled={dispatchState === "dispatching"}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              <PhoneCall className="h-4 w-4" />
              {dispatchState === "dispatching"
                ? "Connecting..."
                : "BROADCAST DISPATCH NOW"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
