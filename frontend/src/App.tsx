import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Incidents, {
  type Incident as IncidentRecord,
} from "./components/Incidents";
import LiveMonitoring from "./components/LiveMonitoring";

const API_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws/monitor";

type Page = "monitor" | "incidents";

interface MonitorMessage {
  type?: string;
  frame?: string;
  accident?: boolean;
  confidence?: number;
  objects?: string[];
  recording?: boolean;
  processing_incident?: boolean;
}

interface IncidentListResponse {
  records: IncidentRecord[];
  total: number;
  limit: number;
  skip: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ChatResponse {
  conversation_id: string;
  response: string;
}

interface SidebarItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
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

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
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
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

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
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-blue-600/10 text-blue-400"
          : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-200"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Sidebar({
  activePage,
  setActivePage,
}: {
  activePage: Page;
  setActivePage: (page: Page) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400">
            <MonitorIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">
              CrashVision
            </p>
            <p className="text-[10px] text-slate-600">AI monitoring</p>
          </div>
        </div>
      </div>

      <nav className="space-y-1">
        <SidebarItem
          label="Live Monitor"
          active={activePage === "monitor"}
          onClick={() => setActivePage("monitor")}
          icon={<MonitorIcon />}
        />
        <SidebarItem
          label="Incidents"
          active={activePage === "incidents"}
          onClick={() => setActivePage("incidents")}
          icon={<IncidentIcon />}
        />
      </nav>

      <div className="mt-auto border-t border-white/[0.06] pt-4">
        <p className="text-[10px] leading-5 text-slate-600">
          YOLO detection · FastAPI · MongoDB · S3 · AI reports
        </p>
      </div>
    </div>
  );
}

function getIncidentId(incident: IncidentRecord): string {
  return incident.record_id || incident.id;
}

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const data: unknown = await response.json().catch(() => null);

  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;

    if (typeof record.detail === "string") return record.detail;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }

  return fallback;
}

function App() {
  const [activePage, setActivePage] = useState<Page>("monitor");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [connected, setConnected] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [accident, setAccident] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [objects, setObjects] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [processingIncident, setProcessingIncident] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] =
    useState<IncidentRecord | null>(null);
  const [incidentLoading, setIncidentLoading] = useState(false);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const closeWebSocket = useCallback(() => {
    const socket = socketRef.current;

    if (!socket) return;

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

  const startMonitoring = useCallback(() => {
    closeWebSocket();

    setConnectionError(null);
    setFrame(null);
    setAccident(false);
    setConfidence(0);
    setObjects([]);
    setRecording(false);
    setProcessingIncident(false);

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setMonitoring(true);
      setConnectionError(null);
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const data: MonitorMessage = JSON.parse(event.data);

        if (data.type !== "frame") return;

        if (typeof data.frame === "string" && data.frame.length > 0) {
          setFrame(`data:image/jpeg;base64,${data.frame}`);
        }

        setAccident(data.accident ?? false);

        const nextConfidence =
          typeof data.confidence === "number" &&
          Number.isFinite(data.confidence)
            ? data.confidence
            : 0;

        setConfidence(Math.min(Math.max(nextConfidence, 0), 1));
        setObjects(Array.isArray(data.objects) ? data.objects : []);
        setRecording(data.recording ?? false);
        setProcessingIncident(data.processing_incident ?? false);
      } catch (error) {
        console.error("Invalid WebSocket message:", error);
      }
    };

    socket.onerror = () => {
      setConnected(false);
      setMonitoring(false);
      setConnectionError(
        "Could not connect to the monitoring service.",
      );
    };

    socket.onclose = () => {
      setConnected(false);
      setMonitoring(false);

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [closeWebSocket]);

  const stopMonitoring = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/stop`, {
        method: "POST",
      });

      if (!response.ok) {
        console.error(
          await getErrorMessage(response, "Unable to stop monitoring."),
        );
      }
    } catch (error) {
      console.error("Unable to stop backend:", error);
    } finally {
      closeWebSocket();

      setConnected(false);
      setMonitoring(false);
      setFrame(null);
      setAccident(false);
      setConfidence(0);
      setObjects([]);
      setRecording(false);
      setProcessingIncident(false);
    }
  }, [closeWebSocket]);

  const loadIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    setIncidentsError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/records?limit=100&skip=0`,
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            "Unable to load incidents.",
          ),
        );
      }

      const data: unknown = await response.json();

      if (
        typeof data !== "object" ||
        data === null ||
        !Array.isArray((data as IncidentListResponse).records)
      ) {
        throw new Error("Invalid incident response from the server.");
      }

      setIncidents(
        (data as IncidentListResponse).records,
      );
    } catch (error) {
      console.error("Incident loading error:", error);
      setIncidentsError(
        error instanceof Error
          ? error.message
          : "Unable to load incidents.",
      );
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  const openIncident = useCallback(async (incidentId: string) => {
    if (!incidentId) {
      setIncidentsError("This incident does not have a valid ID.");
      return;
    }

    setIncidentLoading(true);
    setIncidentsError(null);
    setSelectedIncident(null);
    setConversationId(null);
    setMessages([]);
    setChatError(null);
    setChatInput("");

    try {
      const response = await fetch(
        `${API_URL}/api/records/${encodeURIComponent(incidentId)}`,
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            "Unable to load this incident.",
          ),
        );
      }

      const incident: IncidentRecord = await response.json();

      if (!incident || !getIncidentId(incident)) {
        throw new Error("The server returned an invalid incident.");
      }

      setSelectedIncident(incident);
    } catch (error) {
      console.error("Incident detail loading error:", error);
      setIncidentsError(
        error instanceof Error
          ? error.message
          : "Unable to load this incident.",
      );
    } finally {
      setIncidentLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const question = chatInput.trim();

      if (
        !question ||
        chatLoading ||
        !selectedIncident ||
        selectedIncident.status !== "completed"
      ) {
        return;
      }

      const incidentId = getIncidentId(selectedIncident);

      if (!incidentId) {
        setChatError("This incident does not have a valid ID.");
        return;
      }

      const temporaryId = `local-user-${Date.now()}`;

      setMessages((current) => [
        ...current,
        {
          id: temporaryId,
          role: "user",
          content: question,
        },
      ]);

      setChatInput("");
      setChatLoading(true);
      setChatError(null);

      try {
        const response = await fetch(
          `${API_URL}/api/records/${encodeURIComponent(incidentId)}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: question,
              conversation_id: conversationId,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
              "The AI service returned an error.",
            ),
          );
        }

        const data: ChatResponse = await response.json();

        if (
          !data ||
          typeof data.response !== "string" ||
          typeof data.conversation_id !== "string"
        ) {
          throw new Error("Invalid chat response from the server.");
        }

        setConversationId(data.conversation_id);

        setMessages((current) => [
          ...current,
          {
            id: `local-ai-${Date.now()}`,
            role: "assistant",
            content: data.response,
          },
        ]);
      } catch (error) {
        console.error("Chat error:", error);

        setMessages((current) =>
          current.filter((item) => item.id !== temporaryId),
        );

        setChatError(
          error instanceof Error
            ? error.message
            : "Unable to contact the AI service.",
        );
      } finally {
        setChatLoading(false);
      }
    },
    [chatInput, chatLoading, selectedIncident, conversationId],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (activePage === "incidents") {
      void loadIncidents();
    }
  }, [activePage, loadIncidents]);

  useEffect(() => {
    return () => {
      closeWebSocket();
    };
  }, [closeWebSocket]);

  useEffect(() => {
    setSelectedIncident(null);
    setConversationId(null);
    setMessages([]);
    setChatInput("");
    setChatError(null);
  }, [activePage]);

  const completedIncidentCount = useMemo(
    () =>
      incidents.filter(
        (incident) => incident.status === "completed",
      ).length,
    [incidents],
  );

  return (
    <div className="min-h-screen bg-[#0b0d10] text-slate-100">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          <aside className="relative h-full w-72 border-r border-white/10 bg-[#0d1014] p-5">
            <Sidebar
              activePage={activePage}
              setActivePage={(page) => {
                setActivePage(page);
                setMobileMenuOpen(false);
              }}
            />
          </aside>
        </div>
      )}

      <aside className="fixed left-0 top-0 hidden h-screen w-60 border-r border-white/[0.07] bg-[#0d1014] lg:block">
        <div className="h-full p-5">
          <Sidebar
            activePage={activePage}
            setActivePage={setActivePage}
          />
        </div>
      </aside>

      <main className="min-h-screen lg:ml-60">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b0d10]/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
                aria-label="Open menu"
              >
                <MenuIcon />
              </button>

              <div>
                <div className="text-[11px] text-slate-500">
                  CrashVision /{" "}
                  {activePage === "monitor"
                    ? "Live Monitor"
                    : "Incidents"}
                </div>

                <h1 className="text-sm font-medium text-slate-200">
                  {activePage === "monitor"
                    ? "Live monitoring"
                    : selectedIncident
                      ? "Incident details"
                      : "Incident history"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected
                      ? "bg-emerald-400"
                      : "bg-slate-600"
                  }`}
                />

                <span className="text-xs text-slate-400">
                  {connected ? "Connected" : "Not connected"}
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
                    onClick={() => void stopMonitoring()}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/15"
                  >
                    Stop monitoring
                  </button>
                ))}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {connectionError && activePage === "monitor" && (
            <div className="mb-6 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
              <p className="text-xs text-red-300">
                {connectionError}
              </p>

              <button
                type="button"
                onClick={() => setConnectionError(null)}
                className="text-slate-500 hover:text-white"
                aria-label="Dismiss error"
              >
                <CloseIcon />
              </button>
            </div>
          )}

          {activePage === "monitor" && (
            <LiveMonitoring
              connected={connected}
              monitoring={monitoring}
              frame={frame}
              accident={accident}
              confidence={confidence}
              objects={objects}
              recording={recording}
              processingIncident={processingIncident}
            />
          )}

          {activePage === "incidents" && (
            <Incidents
              incidents={incidents}
              incidentsLoading={incidentsLoading}
              incidentsError={incidentsError}
              completedIncidentCount={completedIncidentCount}
              selectedIncident={selectedIncident}
              incidentLoading={incidentLoading}
              messages={messages}
              chatInput={chatInput}
              chatLoading={chatLoading}
              chatError={chatError}
              conversationId={conversationId}
              messagesEndRef={messagesEndRef}
              onRefreshIncidents={loadIncidents}
              onOpenIncident={openIncident}
              onBack={() => {
                setSelectedIncident(null);
                setConversationId(null);
                setMessages([]);
                setChatInput("");
                setChatError(null);
              }}
              onRefreshIncident={async () => {
                if (selectedIncident) {
                  await openIncident(getIncidentId(selectedIncident));
                }
              }}
              onChatInputChange={setChatInput}
              onSendMessage={sendMessage}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
