import React, { useState } from "react";
import {
  ArrowLeft,
  Video,
  Image as ImageIcon,
  Bot,
  MessageSquare,
  Copy,
  Check,
  FileText,
  ExternalLink,
  ShieldCheck,
  Send,
  X,
  Sparkles,
} from "lucide-react";
import { CardSpotlight } from "../ui/CardSpotlight";
import { TextGenerateEffect } from "../ui/TextGenerateEffect";
import { EmergencyDispatchModal } from "../dashboard/EmergencyDispatchModal";
import type { ChatMessage, IncidentRecord } from "../../types";

interface IncidentDetailsProps {
  incident: IncidentRecord;
  messages: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  chatError: string | null;
  conversationId: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onChatInputChange: (value: string) => void;
  onSendMessage: (textOverride?: string) => void;
}

export const IncidentDetails: React.FC<IncidentDetailsProps> = ({
  incident,
  messages,
  chatInput,
  chatLoading,
  chatError,
  conversationId,
  onBack,
  onChatInputChange,
  onSendMessage,
}) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);

  const incId = incident.record_id || incident.id;
  const dateStr = new Date(incident.created_at).toLocaleString();
  const confidencePct = (incident.confidence * 100).toFixed(1);

  const handleCopyReport = () => {
    if (!incident.report) return;
    navigator.clipboard.writeText(incident.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Back Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Incidents Hub
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono tracking-tight text-white">
                Incident {incId.slice(0, 12)}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                  incident.status === "completed"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                }`}
              >
                {incident.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Recorded: {dateStr}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDispatchModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
          >
            <ShieldCheck className="h-4 w-4 text-red-400" />
            Emergency Dispatch
          </button>

          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110"
          >
            <MessageSquare className="h-4 w-4" />
            Chat with AI Assistant
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Media Players & AI Report (8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Video Evidence Card */}
          <CardSpotlight>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">
                  Recorded Video Evidence (S3)
                </h3>
              </div>

              {incident.video?.url && (
                <a
                  href={incident.video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
                >
                  <span>Open Video in New Tab</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center border border-white/5">
              {incident.video?.url ? (
                <video
                  controls
                  preload="metadata"
                  src={incident.video.url}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <Video className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs">No video stream recorded for this incident.</p>
                </div>
              )}
            </div>
          </CardSpotlight>

          {/* Representative Snapshot Image */}
          <CardSpotlight>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  Accident Frame Snapshot
                </h3>
              </div>

              {incident.image?.url && (
                <a
                  href={incident.image.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                >
                  <span>Full Resolution Image</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center border border-white/5">
              {incident.image?.url ? (
                <img
                  src={incident.image.url}
                  alt={`Incident ${incId}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs">Frame snapshot unavailable.</p>
                </div>
              )}
            </div>
          </CardSpotlight>

          {/* AI Generated Accident Report */}
          <CardSpotlight color="rgba(59, 130, 246, 0.2)">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    CrashVision AI Forensic Report
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Automated analysis from vision pipeline & LLM
                  </p>
                </div>
              </div>

              {incident.report && (
                <button
                  onClick={handleCopyReport}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:text-white transition"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {incident.report ? (
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 font-mono text-xs text-slate-200">
                <TextGenerateEffect words={incident.report} />
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono italic">
                Report generation is still processing...
              </p>
            )}
          </CardSpotlight>
        </div>

        {/* Right Side: Detection Meta & Summary (4 columns) */}
        <div className="lg:col-span-4 space-y-6">
          <CardSpotlight>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              Incident Metadata
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Confidence Score</span>
                <span className="font-bold text-blue-400">{confidencePct}%</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Recording Status</span>
                <span className="text-emerald-400 uppercase font-bold">
                  {incident.status}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Recorded At</span>
                <span className="text-slate-200">{dateStr}</span>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-bold text-slate-400">Detected Entities:</p>
              {incident.objects && incident.objects.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {incident.objects.map((obj, idx) => (
                    <span
                      key={`${obj}-${idx}`}
                      className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-mono font-medium text-cyan-300"
                    >
                      🏷️ {obj}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-mono">None logged.</p>
              )}
            </div>
          </CardSpotlight>
        </div>
      </div>

      {/* Slide-over AI Chat Drawer */}
      {chatOpen && (
        <aside className="fixed right-0 top-0 z-[100] flex h-screen w-full max-w-md flex-col border-l border-white/10 bg-slate-950 p-4 shadow-2xl shadow-black">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Incident AI Assistant</h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  Context: {incId.slice(0, 10)} {conversationId ? `• ${conversationId.slice(0, 8)}` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <Bot className="h-10 w-10 text-blue-400 mx-auto opacity-80" />
                <p className="text-xs text-slate-300 font-semibold">
                  Ask AI about this incident report
                </p>
                <div className="space-y-1.5 max-w-xs mx-auto text-left">
                  {[
                    "Summarize this accident report",
                    "What vehicles were involved?",
                    "What emergency action is recommended?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => onSendMessage(prompt)}
                      className="w-full rounded-xl border border-white/5 bg-slate-900 p-2.5 text-[11px] text-slate-300 hover:border-blue-500/30 hover:text-white transition"
                    >
                      💬 {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "border border-white/10 bg-slate-900 text-slate-200 rounded-bl-none font-mono"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-none border border-white/10 bg-slate-900 p-3 text-xs text-slate-400 font-mono animate-pulse">
                  AI analysis in progress...
                </div>
              </div>
            )}
          </div>

          {/* Input form */}
          {chatError && (
            <p className="text-[10px] text-red-400 mb-2">{chatError}</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSendMessage();
            }}
            className="flex gap-2 border-t border-white/10 pt-3"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => onChatInputChange(e.target.value)}
              placeholder="Ask AI about this incident..."
              className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500/50"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      )}

      {/* Emergency Modal */}
      <EmergencyDispatchModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        incidentId={incId}
      />
    </div>
  );
};
