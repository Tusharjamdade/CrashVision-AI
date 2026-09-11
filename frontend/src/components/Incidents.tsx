import { useEffect, useState, type FormEvent, type RefObject } from "react";

interface IncidentMedia {
  key: string;
  url: string | null;
}

export interface Incident {
  id: string;
  record_id?: string | null;
  created_at: string;
  status: "processing" | "completed" | "failed" | string;
  accident: boolean;
  confidence: number;
  objects: string[];
  report: string | null;
  video: IncidentMedia | null;
  image: IncidentMedia | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

function getIncidentId(incident: Incident): string {
  return incident.record_id || incident.id;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatConfidence(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${Math.min(Math.max(safeValue * 100, 0), 100).toFixed(1)}%`;
}

function getObjects(incident: Incident): string[] {
  return Array.isArray(incident.objects) ? incident.objects : [];
}

function getMedia(
  media: IncidentMedia | null | undefined,
): IncidentMedia | null {
  if (!media) return null;

  return {
    key: media.key || "",
    url: media.url || null,
  };
}

function normalizeIncident(incident: Incident): Incident {
  return {
    ...incident,
    id: incident.id || incident.record_id || "",
    objects: getObjects(incident),
    video: getMedia(incident.video),
    image: getMedia(incident.image),
    report: incident.report ?? null,
    confidence: Number.isFinite(incident.confidence)
      ? incident.confidence
      : 0,
  };
}

function MonitorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 21h8M12 18v3" />
      <path d="m7 13 3-3 2 2 4-4" />
    </svg>
  );
}

function IncidentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M12 3 21 19H3L12 3Z" />
      <path d="M12 9v4M12 16h.01" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="13" height="14" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4M8 13h.01M16 13h.01M8 17h8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="m4 4 16 8-16 8 3-8-3-8Z" />
      <path d="M7 12h13" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4" />
      <path d="M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 17 5-5 3 3 2-2 6 6" />
    </svg>
  );
}

interface StatProps {
  label: string;
  value: string;
  detail: string;
}

function Stat({ label, value, detail }: StatProps) {
  return (
    <div className="bg-[#101318] px-5 py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-slate-200">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-600">{detail}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "completed"
      ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
      : status === "processing"
        ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-400"
        : status === "failed"
          ? "border-red-500/20 bg-red-500/[0.06] text-red-400"
          : "border-white/[0.08] bg-white/[0.03] text-slate-500";

  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase ${styles}`}
    >
      {status}
    </span>
  );
}

export interface IncidentsProps {
  incidents: Incident[];
  incidentsLoading: boolean;
  incidentsError: string | null;
  completedIncidentCount: number;
  selectedIncident: Incident | null;
  incidentLoading: boolean;
  messages: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  chatError: string | null;
  conversationId: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onRefreshIncidents: () => void | Promise<void>;
  onOpenIncident: (id: string) => void | Promise<void>;
  onBack: () => void;
  onRefreshIncident: () => void | Promise<void>;
  onChatInputChange: (value: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
}

export default function Incidents({
  incidents,
  incidentsLoading,
  incidentsError,
  completedIncidentCount,
  selectedIncident,
  incidentLoading,
  messages,
  chatInput,
  chatLoading,
  chatError,
  conversationId,
  messagesEndRef,
  onRefreshIncidents,
  onOpenIncident,
  onBack,
  onRefreshIncident,
  onChatInputChange,
  onSendMessage,
}: IncidentsProps) {
  const safeSelectedIncident = selectedIncident
    ? normalizeIncident(selectedIncident)
    : null;

  const safeIncidents = Array.isArray(incidents)
    ? incidents.map(normalizeIncident)
    : [];

  return (
    <>
      {safeSelectedIncident ? (
        <IncidentDetails
          incident={safeSelectedIncident}
          messages={messages}
          chatInput={chatInput}
          chatLoading={chatLoading}
          chatError={chatError}
          conversationId={conversationId}
          messagesEndRef={messagesEndRef}
          onBack={onBack}
          onRefresh={onRefreshIncident}
          onChatInputChange={onChatInputChange}
          onSendMessage={onSendMessage}
        />
      ) : (
        <IncidentList
          incidents={safeIncidents}
          loading={incidentsLoading}
          error={incidentsError}
          completedCount={completedIncidentCount}
          onRefresh={onRefreshIncidents}
          onOpen={onOpenIncident}
        />
      )}

      {incidentLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-xl border border-white/10 bg-[#101318] px-6 py-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
              <span className="text-sm text-slate-300">
                Loading incident...
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IncidentList({
  incidents,
  loading,
  error,
  completedCount,
  onRefresh,
  onOpen,
}: {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  completedCount: number;
  onRefresh: () => void | Promise<void>;
  onOpen: (id: string) => void | Promise<void>;
}) {
  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
            Incidents
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Review recorded accidents, evidence, reports and conversations.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50"
        >
          <RefreshIcon />
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
        <Stat
          label="Total incidents"
          value={String(incidents.length)}
          detail="Loaded records"
        />

        <Stat
          label="Completed"
          value={String(completedCount)}
          detail="Ready for review"
        />

        <Stat
          label="Evidence"
          value={String(
            incidents.filter(
              (incident) => Boolean(incident.video || incident.image),
            ).length,
          )}
          detail="With media"
        />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-white/[0.07] bg-[#101318]">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
            Loading incidents...
          </div>
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-white/[0.07] bg-[#101318]">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center border border-white/[0.07] bg-white/[0.03] text-slate-500">
              <IncidentIcon />
            </div>

            <h3 className="text-lg font-semibold text-slate-200">
              No incidents yet
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Start live monitoring. When an accident is confirmed, the
              backend will save the video and image to S3 and create the
              incident here.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#101318]">
          <div className="hidden grid-cols-[72px_minmax(0,1fr)_150px_120px_100px] gap-4 border-b border-white/[0.07] px-5 py-3 text-[10px] uppercase tracking-wider text-slate-600 md:grid">
            <span>Evidence</span>
            <span>Incident</span>
            <span>Created</span>
            <span>Confidence</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-white/[0.05]">
            {incidents.map((incident) => {
              const incidentId = getIncidentId(incident);

              return (
                <button
                  key={incidentId}
                  type="button"
                  onClick={() => onOpen(incidentId)}
                  className="group grid w-full grid-cols-[64px_minmax(0,1fr)] gap-4 px-5 py-4 text-left transition hover:bg-white/[0.025] md:grid-cols-[72px_minmax(0,1fr)_150px_120px_100px] md:items-center"
                >
                  <div className="h-12 w-16 overflow-hidden rounded-md border border-white/[0.07] bg-black">
                    {incident.image?.url ? (
                      <img
                        src={incident.image.url}
                        alt="Incident evidence"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-700">
                        <ImageIcon />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-200">
                        Incident {incidentId.slice(0, 8)}
                      </p>

                      {incident.video && (
                        <span className="hidden rounded border border-blue-500/10 bg-blue-500/[0.06] px-1.5 py-0.5 text-[9px] text-blue-400 sm:inline">
                          VIDEO
                        </span>
                      )}
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {getObjects(incident).length > 0
                        ? getObjects(incident).join(", ")
                        : "No objects recorded"}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-600 md:hidden">
                      {formatDate(incident.created_at)}
                    </p>
                  </div>

                  <p className="hidden text-xs text-slate-500 md:block">
                    {formatDate(incident.created_at)}
                  </p>

                  <p className="hidden text-xs text-slate-400 md:block">
                    {formatConfidence(incident.confidence)}
                  </p>

                  <div className="hidden md:block">
                    <StatusBadge status={incident.status} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function ChatToggleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.6-.8L4 20l1.3-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
      <path d="M8 11h8M8 14h5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function IncidentDetails({
  incident,
  messages,
  chatInput,
  chatLoading,
  chatError,
  conversationId,
  messagesEndRef,
  onBack,
  onRefresh,
  onChatInputChange,
  onSendMessage,
}: {
  incident: Incident;
  messages: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  chatError: string | null;
  conversationId: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
  onChatInputChange: (value: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const incidentId = getIncidentId(incident);
  const objects = getObjects(incident);
  const confidence = Math.min(
    Math.max(Number.isFinite(incident.confidence) ? incident.confidence : 0, 0),
    1,
  );
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!chatOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setChatOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatOpen]);

  return (
    <>
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 flex items-center gap-2 text-xs text-slate-500 transition hover:text-slate-200"
        >
          <ArrowLeftIcon />
          Back to incidents
        </button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
                Incident {incidentId.slice(0, 8)}
              </h2>
              <StatusBadge status={incident.status} />
            </div>

            <p className="text-sm text-slate-500">
              Recorded {formatDate(incident.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="group flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-3.5 py-2 text-xs font-medium text-blue-300 shadow-sm transition hover:border-blue-400/30 hover:bg-blue-500/[0.12]"
              aria-label="Open incident AI chat"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 transition group-hover:bg-blue-500/20">
                <ChatToggleIcon />
              </span>
              Chat with AI
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06]"
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] lg:grid-cols-4">
        <Stat
          label="Confidence"
          value={formatConfidence(confidence)}
          detail="Accident classifier"
        />

        <Stat
          label="Objects"
          value={String(objects.length)}
          detail="Detected objects"
        />

        <Stat
          label="Video"
          value={incident.video ? "Available" : "Missing"}
          detail="S3 evidence"
        />

        <Stat
          label="Image"
          value={incident.image ? "Available" : "Missing"}
          detail="S3 evidence"
        />
      </div>

      {incident.status === "processing" && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3">
          <p className="text-xs text-amber-300">
            This incident is still being processed. Refresh this page after the
            backend finishes uploading evidence and generating the report.
          </p>
        </div>
      )}

      {incident.status === "failed" && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3">
          <p className="text-xs text-red-300">
            The backend could not finish processing this incident. Check the
            FastAPI server logs.
          </p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#101318]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <h3 className="text-sm font-medium text-slate-200">
                  Incident video
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Evidence stored in Amazon S3
                </p>
              </div>

              {incident.video?.url && (
                <a
                  href={incident.video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Open video →
                </a>
              )}
            </div>

            <div className="bg-black p-3">
              {incident.video?.url ? (
                <video
                  controls
                  preload="metadata"
                  src={incident.video.url}
                  className="mx-auto max-h-[620px] w-full"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center">
                  <div className="text-center text-slate-600">
                    <VideoIcon />
                    <p className="mt-3 text-sm text-slate-500">
                      Video is not available.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#101318]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <h3 className="text-sm font-medium text-slate-200">
                  Incident image
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Representative frame from the recorded evidence
                </p>
              </div>

              {incident.image?.url && (
                <a
                  href={incident.image.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Open image →
                </a>
              )}
            </div>

            <div className="bg-black p-3">
              {incident.image?.url ? (
                <img
                  src={incident.image.url}
                  alt={`Incident ${incidentId}`}
                  className="mx-auto max-h-[600px] w-full object-contain"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center">
                  <div className="text-center text-slate-600">
                    <ImageIcon />
                    <p className="mt-3 text-sm">Image is not available.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-[#101318]">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2">
                <BotIcon />
                <div>
                  <h3 className="text-sm font-medium text-slate-200">
                    Incident report
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Generated by CrashVision AI
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              {incident.report ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {incident.report}
                </p>
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  No report is available yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-[#101318]">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <h3 className="text-sm font-medium text-slate-200">
                Detection details
              </h3>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <p className="mb-2 text-[11px] text-slate-500">
                  Accident confidence
                </p>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-slate-300">
                  {formatConfidence(confidence)}
                </p>
              </div>

              <div>
                <p className="mb-2 text-[11px] text-slate-500">
                  Detected objects
                </p>

                {objects.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {objects.map((object, index) => (
                      <span
                        key={`${object}-${index}`}
                        className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400"
                      >
                        {object}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    No objects recorded.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {chatOpen && (
        <aside
          role="dialog"
          aria-label="Incident AI chat"
          className="fixed right-0 top-0 z-[100] flex h-screen w-full max-w-[400px] flex-col border-l border-white/[0.08] bg-[#0d1015] shadow-[-18px_0_50px_rgba(0,0,0,0.28)]"
        >
            <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#10141a] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/10">
                  <BotIcon />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Incident AI
                    </h3>
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Online
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    Incident {incidentId.slice(0, 8)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
                aria-label="Close chat"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              {messages.length === 0 ? (
                <div className="flex min-h-full items-center justify-center text-center">
                  <div className="max-w-[290px]">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-violet-500/10 text-blue-400 ring-1 ring-blue-500/10">
                      <BotIcon />
                    </div>

                    <p className="text-sm font-medium text-slate-300">
                      Ask about this incident
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      Ask about the report, detected objects, confidence, or
                      recorded evidence.
                    </p>

                    <div className="mt-5 space-y-2">
                      {[
                        "Summarize this incident",
                        "What objects were detected?",
                        "Explain the AI report",
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => onChatInputChange(suggestion)}
                          className="block w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-left text-[11px] text-slate-500 transition hover:border-blue-500/20 hover:bg-blue-500/[0.05] hover:text-slate-300"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                          message.role === "user"
                            ? "rounded-br-md bg-blue-600 text-white"
                            : "rounded-bl-md border border-white/[0.07] bg-[#171b22] text-slate-300"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md border border-white/[0.07] bg-[#171b22] px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:240ms]" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {chatError && (
              <div className="mx-3 mb-2 rounded-lg border border-red-500/15 bg-red-500/[0.05] px-3 py-2">
                <p className="text-[11px] leading-4 text-red-400">
                  {chatError}
                </p>
              </div>
            )}

            <form
              onSubmit={onSendMessage}
              className="border-t border-white/[0.07] bg-[#0c0f13] p-3"
            >
              <div className="rounded-2xl border border-white/[0.08] bg-[#11151b] p-1.5 transition focus-within:border-blue-500/30 focus-within:ring-1 focus-within:ring-blue-500/10">
                <div className="flex items-end gap-1.5">
                  <textarea
                    value={chatInput}
                    onChange={(event) => onChatInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();

                        if (
                          chatInput.trim() &&
                          !chatLoading &&
                          incident.status === "completed"
                        ) {
                          event.currentTarget.form?.requestSubmit();
                        }
                      }
                    }}
                    disabled={
                      chatLoading || incident.status !== "completed"
                    }
                    rows={1}
                    placeholder={
                      incident.status === "completed"
                        ? "Message Incident AI..."
                        : "Incident is still processing..."
                    }
                    className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 disabled:opacity-50"
                  />

                  <button
                    type="submit"
                    disabled={
                      !chatInput.trim() ||
                      chatLoading ||
                      incident.status !== "completed"
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
                    aria-label="Send message"
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between px-1">
                <p className="text-[9px] text-slate-600">
                  Enter to send · Shift + Enter for new line
                </p>
                {conversationId && (
                  <span className="max-w-[100px] truncate text-[9px] text-slate-700">
                    {conversationId.slice(0, 8)}
                  </span>
                )}
              </div>
            </form>
        </aside>
      )}
    </>
  );
}