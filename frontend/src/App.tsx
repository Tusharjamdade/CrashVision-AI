import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

const API_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws/monitor";

// ============================================================
// TYPES
// ============================================================

type Page = "monitor" | "incidents" | "evidence";

interface MonitorMessage {
  type?: string;
  frame?: string;
  accident?: boolean;
  confidence?: number;
  objects?: string[];
  recording?: boolean;
  report?: string | null;
  video?: string | null;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  response?: string;
  message?: string;
  detail?: string;
}

interface SidebarItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

interface StatProps {
  label: string;
  value: string;
  detail: string;
}

// ============================================================
// ICONS
// ============================================================

function MonitorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-[18px] w-[18px]"
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
    >
      <path d="m4 4 16 8-16 8 3-8-3-8Z" />
      <path d="M7 12h13" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// ============================================================
// APP
// ============================================================

function App() {
  // ----------------------------------------------------------
  // Monitoring
  // ----------------------------------------------------------

  const [connected, setConnected] = useState(false);
  const [monitoring, setMonitoring] = useState(false);

  const [frame, setFrame] = useState<string | null>(null);
  const [accident, setAccident] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [objects, setObjects] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);

  const [connectionError, setConnectionError] =
    useState<string | null>(null);

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  const [activePage, setActivePage] =
    useState<Page>("monitor");

  const [chatOpen, setChatOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ----------------------------------------------------------
  // Chat
  // ----------------------------------------------------------

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Hi. I'm the CrashVision assistant. Ask me about the current detection, an incident report, or the evidence captured by the system.",
    },
  ]);

  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(
    null
  );

  // ----------------------------------------------------------
  // Refs
  // ----------------------------------------------------------

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ============================================================
  // SCROLL CHAT
  // ============================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, chatLoading]);

  // ============================================================
  // CLOSE WEBSOCKET
  // ============================================================

  const closeWebSocket = useCallback(() => {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }

    socketRef.current = null;
  }, []);

  // ============================================================
  // CONNECT WEBSOCKET
  // ============================================================

  const startMonitoring = useCallback(() => {
    setConnectionError(null);

    closeWebSocket();

    const socket = new WebSocket(WS_URL);

    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setMonitoring(true);
      setConnectionError(null);
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const data: MonitorMessage = JSON.parse(
          event.data
        );

        if (data.type !== "frame") {
          return;
        }

        if (data.frame) {
          setFrame(
            `data:image/jpeg;base64,${data.frame}`
          );
        }

        setAccident(data.accident ?? false);

        setConfidence(
          Math.min(
            Math.max(data.confidence ?? 0, 0),
            1
          )
        );

        setObjects(data.objects ?? []);

        setRecording(data.recording ?? false);

        if (data.report) {
          setReport(data.report);
        }

        if (data.video) {
          setVideo(
            data.video.startsWith("http")
              ? data.video
              : `${API_URL}${data.video}`
          );
        }
      } catch (error) {
        console.error(
          "Invalid WebSocket message:",
          error
        );
      }
    };

    socket.onerror = () => {
      setConnected(false);
      setMonitoring(false);

      setConnectionError(
        "Could not connect to the monitoring service."
      );
    };

    socket.onclose = () => {
      setConnected(false);
      setMonitoring(false);
      socketRef.current = null;
    };
  }, [closeWebSocket]);

  // ============================================================
  // STOP MONITORING
  // ============================================================

  const stopMonitoring = async () => {
    try {
      await fetch(`${API_URL}/api/stop`, {
        method: "POST",
      });
    } catch (error) {
      console.error(
        "Unable to stop backend:",
        error
      );
    }

    closeWebSocket();

    setConnected(false);
    setMonitoring(false);
    setFrame(null);
    setAccident(false);
    setConfidence(0);
    setObjects([]);
    setRecording(false);
  };

  // ============================================================
  // CHAT
  // ============================================================

  const sendMessage = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const question = chatInput.trim();

    if (!question || chatLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: question,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: question,
            accident,
            confidence,
            objects,
            report,
          }),
        }
      );

      const data: ChatResponse = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "The AI service returned an error."
        );
      }

      const assistantText =
        data.response ||
        data.message ||
        "I couldn't generate a response.";

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: assistantText,
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to contact the AI service.";

      setChatError(message);
    } finally {
      setChatLoading(false);
    }
  };

  // ============================================================
  // CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      closeWebSocket();
    };
  }, [closeWebSocket]);

  // ============================================================
  // VALUES
  // ============================================================

  const confidencePercentage =
    confidence * 100;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#0b0d10] text-slate-100">
      {/* ====================================================== */}
      {/* MOBILE SIDEBAR */}
      {/* ====================================================== */}

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() =>
              setMobileMenuOpen(false)
            }
            className="absolute inset-0 bg-black/60"
          />

          <aside className="relative h-full w-72 border-r border-white/10 bg-[#0d1014] p-5">
            <Sidebar
              activePage={activePage}
              setActivePage={(page) => {
                setActivePage(page);
                setMobileMenuOpen(false);
              }}
              chatOpen={chatOpen}
              setChatOpen={setChatOpen}
              agentsOpen={agentsOpen}
              setAgentsOpen={setAgentsOpen}
            />
          </aside>
        </div>
      )}

      {/* ====================================================== */}
      {/* DESKTOP SIDEBAR */}
      {/* ====================================================== */}

      <aside className="fixed left-0 top-0 hidden h-screen w-60 border-r border-white/[0.07] bg-[#0d1014] lg:block">
        <div className="p-5">
          <Sidebar
            activePage={activePage}
            setActivePage={setActivePage}
            chatOpen={chatOpen}
            setChatOpen={setChatOpen}
            agentsOpen={agentsOpen}
            setAgentsOpen={setAgentsOpen}
          />
        </div>
      </aside>

      {/* ====================================================== */}
      {/* MAIN */}
      {/* ====================================================== */}

      <main className="min-h-screen lg:ml-60">
        {/* HEADER */}

        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b0d10]/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen(true)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
              >
                <MenuIcon />
              </button>

              <div>
                <div className="text-[11px] text-slate-500">
                  CrashVision /{" "}
                  {activePage === "monitor"
                    ? "Live Monitor"
                    : activePage === "incidents"
                    ? "Incidents"
                    : "Evidence"}
                </div>

                <h1 className="text-sm font-medium text-slate-200">
                  {activePage === "monitor"
                    ? "Live monitoring"
                    : activePage === "incidents"
                    ? "Incident history"
                    : "Evidence library"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Connection */}

              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected
                      ? "bg-emerald-400"
                      : "bg-slate-600"
                  }`}
                />

                <span className="text-xs text-slate-400">
                  {connected
                    ? "Connected"
                    : "Not connected"}
                </span>
              </div>

              {activePage === "monitor" &&
                (!monitoring ? (
                  <button
                    type="button"
                    onClick={startMonitoring}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
                  >
                    Start monitoring
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopMonitoring}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/15"
                  >
                    Stop monitoring
                  </button>
                ))}
            </div>
          </div>
        </header>

        {/* CONTENT */}

        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {/* ERROR */}

          {connectionError && (
            <div className="mb-6 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
              <p className="text-xs text-red-300">
                {connectionError}
              </p>

              <button
                type="button"
                onClick={() =>
                  setConnectionError(null)
                }
                className="text-slate-500 hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>
          )}

          {/* ================================================== */}
          {/* MONITOR */}
          {/* ================================================== */}

          {activePage === "monitor" && (
            <>
              {/* TITLE */}

              <div className="mb-7">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Accident monitoring
                  </h2>

                  {monitoring && (
                    <span className="flex items-center gap-1.5 rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      LIVE
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Monitor camera activity and review
                  AI-generated incident analysis.
                </p>
              </div>

              {/* STATS */}

              <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] lg:grid-cols-4">
                <Stat
                  label="System"
                  value={
                    connected ? "Online" : "Offline"
                  }
                  detail="FastAPI"
                />

                <Stat
                  label="Detection"
                  value={
                    accident ? "Alert" : "Clear"
                  }
                  detail={
                    accident
                      ? "Potential accident"
                      : "No incident"
                  }
                />

                <Stat
                  label="Confidence"
                  value={`${confidencePercentage.toFixed(
                    1
                  )}%`}
                  detail="Classifier"
                />

                <Stat
                  label="Objects"
                  value={String(objects.length)}
                  detail="In current frame"
                />
              </div>

              {/* CAMERA + ANALYSIS */}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                {/* CAMERA */}

                <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#101318]">
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                    <div>
                      <h3 className="text-sm font-medium">
                        Camera feed
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Real-time YOLO inference
                      </p>
                    </div>

                    {recording && (
                      <span className="flex items-center gap-2 text-[10px] font-medium text-red-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        RECORDING
                      </span>
                    )}
                  </div>

                  <div className="relative aspect-video bg-black">
                    {frame ? (
                      <img
                        src={frame}
                        alt="Live camera"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 text-slate-600">
                          <MonitorIcon />
                        </div>

                        <p className="text-sm text-slate-400">
                          Camera is not running
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          Start monitoring to begin
                        </p>
                      </div>
                    )}

                    {accident && (
                      <div className="absolute left-4 right-4 top-4 flex items-center justify-between border border-red-500/30 bg-red-950/80 px-4 py-3 backdrop-blur-md">
                        <div>
                          <p className="text-xs font-semibold text-red-300">
                            Accident detected
                          </p>

                          <p className="mt-0.5 text-[10px] text-red-400/70">
                            Immediate attention may be required
                          </p>
                        </div>

                        <span className="text-sm font-semibold text-red-300">
                          {confidencePercentage.toFixed(
                            1
                          )}
                          %
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                {/* ANALYSIS */}

                <section className="rounded-xl border border-white/[0.07] bg-[#101318]">
                  <div className="border-b border-white/[0.07] px-5 py-4">
                    <h3 className="text-sm font-medium">
                      Detection analysis
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Current frame
                    </p>
                  </div>

                  <div className="space-y-6 p-5">
                    {/* Status */}

                    <div>
                      <p className="mb-2 text-[11px] text-slate-500">
                        Classification
                      </p>

                      <div
                        className={`flex items-center gap-3 border p-3 ${
                          accident
                            ? "border-red-500/20 bg-red-500/[0.05]"
                            : "border-emerald-500/20 bg-emerald-500/[0.04]"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            accident
                              ? "bg-red-400"
                              : "bg-emerald-400"
                          }`}
                        />

                        <span
                          className={`text-sm font-medium ${
                            accident
                              ? "text-red-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {accident
                            ? "Accident detected"
                            : "Scene clear"}
                        </span>
                      </div>
                    </div>

                    {/* Confidence */}

                    <div>
                      <div className="mb-2 flex justify-between">
                        <span className="text-[11px] text-slate-500">
                          Confidence
                        </span>

                        <span className="text-[11px] text-slate-300">
                          {confidencePercentage.toFixed(
                            1
                          )}
                          %
                        </span>
                      </div>

                      <div className="h-1.5 bg-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            accident
                              ? "bg-red-500"
                              : "bg-blue-500"
                          }`}
                          style={{
                            width: `${confidencePercentage}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Objects */}

                    <div>
                      <div className="mb-2 flex justify-between">
                        <span className="text-[11px] text-slate-500">
                          Detected objects
                        </span>

                        <span className="text-[11px] text-slate-600">
                          {objects.length}
                        </span>
                      </div>

                      {objects.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {objects.map(
                            (object, index) => (
                              <span
                                key={`${object}-${index}`}
                                className="border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400"
                              >
                                {object}
                              </span>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600">
                          Nothing detected yet.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* AI REPORT */}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-white/[0.07] bg-[#101318]">
                  <div className="border-b border-white/[0.07] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <BotIcon />

                      <div>
                        <h3 className="text-sm font-medium">
                          Incident report
                        </h3>

                        <p className="text-[10px] text-slate-500">
                          Generated by Groq
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {report ? (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {report}
                      </p>
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-sm text-slate-500">
                          No incident report
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          A report will appear after an
                          accident is recorded.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* AGENTS */}

                <section className="rounded-xl border border-white/[0.07] bg-[#101318]">
                  <button
                    type="button"
                    onClick={() =>
                      setAgentsOpen(
                        (value) => !value
                      )
                    }
                    className="flex w-full items-center justify-between border-b border-white/[0.07] px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <BotIcon />

                      <div>
                        <h3 className="text-sm font-medium">
                          AI agents
                        </h3>

                        <p className="text-[10px] text-slate-500">
                          Detection pipeline
                        </p>
                      </div>
                    </div>

                    <span className="text-xs text-slate-500">
                      {agentsOpen ? "Hide" : "Show"}
                    </span>
                  </button>

                  {agentsOpen && (
                    <div className="divide-y divide-white/[0.05]">
                      <AgentRow
                        name="Detection"
                        description="Processes camera frames"
                        active={monitoring}
                      />

                      <AgentRow
                        name="Incident analysis"
                        description="Evaluates detected events"
                        active={accident}
                      />

                      <AgentRow
                        name="Report generation"
                        description="Creates incident summaries"
                        active={Boolean(report)}
                      />

                      <AgentRow
                        name="Emergency alert"
                        description="Notification service"
                        active={false}
                      />
                    </div>
                  )}
                </section>
              </div>

              {/* VIDEO */}

              {video && (
                <section className="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-[#101318]">
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                    <div>
                      <h3 className="text-sm font-medium">
                        Recorded evidence
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Captured incident footage
                      </p>
                    </div>

                    <a
                      href={video}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Open video →
                    </a>
                  </div>

                  <div className="bg-black p-3">
                    <video
                      controls
                      src={video}
                      className="mx-auto max-h-[600px] w-full"
                    />
                  </div>
                </section>
              )}
            </>
          )}

          {/* ================================================== */}
          {/* INCIDENTS */}
          {/* ================================================== */}

          {activePage === "incidents" && (
            <EmptyState
              icon={<IncidentIcon />}
              title="Incident history"
              description="Detected accidents and their AI-generated reports will appear here."
            />
          )}

          {/* ================================================== */}
          {/* EVIDENCE */}
          {/* ================================================== */}

          {activePage === "evidence" && (
            <EmptyState
              icon={<VideoIcon />}
              title="Evidence library"
              description="Recorded incident footage and stored evidence will appear here."
            />
          )}
        </div>
      </main>

      {/* ====================================================== */}
      {/* CHAT WINDOW */}
      {/* ====================================================== */}

      {chatOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(650px,calc(100vh-32px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101318] shadow-2xl shadow-black/40">
          {/* Chat header */}

          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <BotIcon />
              </div>

              <div>
                <p className="text-sm font-medium">
                  CrashVision AI
                </p>

                <p className="text-[10px] text-emerald-400">
                  Assistant
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"
              aria-label="Close chat"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Messages */}

          <div className="flex-1 overflow-y-auto px-4 py-5">
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
                    className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-5 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "border border-white/[0.07] bg-[#171a20] text-slate-300"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="border border-white/[0.07] bg-[#171a20] px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:100ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:200ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Chat error */}

          {chatError && (
            <div className="border-t border-red-500/10 bg-red-500/[0.04] px-4 py-2">
              <p className="text-[11px] text-red-400">
                {chatError}
              </p>
            </div>
          )}

          {/* Input */}

          <form
            onSubmit={sendMessage}
            className="border-t border-white/[0.07] p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={(event) =>
                  setChatInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();

                    if (
                      chatInput.trim() &&
                      !chatLoading
                    ) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                disabled={chatLoading}
                rows={1}
                placeholder="Ask about an incident..."
                className="max-h-28 min-h-10 flex-1 resize-none border border-white/[0.08] bg-[#0c0f13] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/40 disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={
                  !chatInput.trim() ||
                  chatLoading
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>

            <p className="mt-2 px-1 text-[10px] text-slate-600">
              Enter to send · Shift + Enter for a new line
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  chatOpen: boolean;
  setChatOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  agentsOpen: boolean;
  setAgentsOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;
}

function Sidebar({
  activePage,
  setActivePage,
  chatOpen,
  setChatOpen,
  agentsOpen,
  setAgentsOpen,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}

      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <span className="text-sm font-bold">
            CV
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold">
            CrashVision
          </p>

          <p className="text-[10px] text-slate-500">
            Accident intelligence
          </p>
        </div>
      </div>

      {/* Workspace */}

      <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-slate-600">
        Workspace
      </p>

      <nav className="space-y-1">
        <SidebarItem
          label="Live monitor"
          active={activePage === "monitor"}
          onClick={() =>
            setActivePage("monitor")
          }
          icon={<MonitorIcon />}
        />

        <SidebarItem
          label="Incidents"
          active={activePage === "incidents"}
          onClick={() =>
            setActivePage("incidents")
          }
          icon={<IncidentIcon />}
        />

        <SidebarItem
          label="Evidence"
          active={activePage === "evidence"}
          onClick={() =>
            setActivePage("evidence")
          }
          icon={<VideoIcon />}
        />
      </nav>

      {/* AI */}

      <p className="mb-2 mt-8 px-2 text-[10px] font-medium uppercase tracking-wider text-slate-600">
        AI tools
      </p>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() =>
            setChatOpen((value) => !value)
          }
          className={`flex w-full items-center justify-between px-2.5 py-2.5 text-sm transition ${
            chatOpen
              ? "bg-blue-600/10 text-blue-400"
              : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
          }`}
        >
          <span className="flex items-center gap-3">
            <BotIcon />
            AI assistant
          </span>

          <span
            className={`h-1.5 w-1.5 rounded-full ${
              chatOpen
                ? "bg-blue-400"
                : "bg-slate-700"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() =>
            setAgentsOpen((value) => !value)
          }
          className={`flex w-full items-center justify-between px-2.5 py-2.5 text-sm transition ${
            agentsOpen
              ? "bg-blue-600/10 text-blue-400"
              : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
          }`}
        >
          <span className="flex items-center gap-3">
            <BotIcon />
            AI agents
          </span>

          <span
            className={`h-1.5 w-1.5 rounded-full ${
              agentsOpen
                ? "bg-blue-400"
                : "bg-slate-700"
            }`}
          />
        </button>
      </div>

      {/* Bottom */}

      <div className="mt-auto border-t border-white/[0.07] pt-5">
        <div className="px-2">
          <p className="text-xs font-medium text-slate-400">
            System status
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-[11px] text-slate-500">
              YOLO engine ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR ITEM
// ============================================================

function SidebarItem({
  label,
  active,
  onClick,
  icon,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-2.5 py-2.5 text-sm transition ${
        active
          ? "bg-white/[0.06] text-white"
          : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ============================================================
// STAT
// ============================================================

function Stat({
  label,
  value,
  detail,
}: StatProps) {
  return (
    <div className="bg-[#101318] px-4 py-4 sm:px-5">
      <p className="text-[10px] uppercase tracking-wide text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-slate-200">
        {value}
      </p>

      <p className="mt-0.5 text-[10px] text-slate-600">
        {detail}
      </p>
    </div>
  );
}

// ============================================================
// AGENT ROW
// ============================================================

function AgentRow({
  name,
  description,
  active,
}: {
  name: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div>
        <p className="text-xs text-slate-300">
          {name}
        </p>

        <p className="mt-0.5 text-[10px] text-slate-600">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            active
              ? "bg-emerald-400"
              : "bg-slate-700"
          }`}
        />

        <span className="text-[9px] text-slate-600">
          {active ? "ACTIVE" : "IDLE"}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center border border-white/[0.07] bg-white/[0.03] text-slate-500">
          {icon}
        </div>

        <h2 className="text-xl font-semibold">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

export default App;