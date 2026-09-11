export interface LiveMonitoringProps {
  connected: boolean;
  monitoring: boolean;
  frame: string | null;
  accident: boolean;
  confidence: number;
  objects: string[];
  recording: boolean;
  processingIncident: boolean;
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

export default function LiveMonitoring({
  connected,
  monitoring,
  frame,
  accident,
  confidence,
  objects,
  recording,
  processingIncident,
}: LiveMonitoringProps) {
  const safeConfidence = Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence))
    : 0;

  const confidencePercentage = safeConfidence * 100;
  const safeObjects = Array.isArray(objects) ? objects : [];

  return (
    <main className="min-w-0">
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
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
          Monitor camera activity and detect potential accidents in real time.
        </p>
      </div>

      {/* STATS */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] lg:grid-cols-4">
        <Stat
          label="System"
          value={connected ? "Online" : "Offline"}
          detail="FastAPI"
        />

        <Stat
          label="Detection"
          value={accident ? "Alert" : "Clear"}
          detail={accident ? "Potential accident" : "No incident"}
        />

        <Stat
          label="Confidence"
          value={`${confidencePercentage.toFixed(1)}%`}
          detail="Classifier"
        />

        <Stat
          label="Objects"
          value={String(safeObjects.length)}
          detail="In current frame"
        />
      </div>

      {/* CAMERA + DETECTION */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* CAMERA */}
        <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#101318]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <h3 className="text-sm font-medium text-slate-200">
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

            {!recording && processingIncident && (
              <span className="text-[10px] font-medium text-amber-400">
                SAVING INCIDENT
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
                    Evidence recording may be active
                  </p>
                </div>

                <span className="text-sm font-semibold text-red-300">
                  {confidencePercentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </section>

        {/* DETECTION ONLY — NO AI REPORT */}
        <section className="rounded-xl border border-white/[0.07] bg-[#101318]">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <h3 className="text-sm font-medium text-slate-200">Detection</h3>

            <p className="mt-1 text-xs text-slate-500">Current frame</p>
          </div>

          <div className="space-y-6 p-5">
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
                    accident ? "bg-red-400" : "bg-emerald-400"
                  }`}
                />

                <span
                  className={`text-sm font-medium ${
                    accident ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {accident ? "Accident detected" : "Scene clear"}
                </span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between">
                <span className="text-[11px] text-slate-500">Confidence</span>

                <span className="text-[11px] text-slate-300">
                  {confidencePercentage.toFixed(1)}%
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-sm bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    accident ? "bg-red-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${confidencePercentage}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between">
                <span className="text-[11px] text-slate-500">
                  Detected objects
                </span>

                <span className="text-[11px] text-slate-600">
                  {safeObjects.length}
                </span>
              </div>

              {safeObjects.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {safeObjects.map((object, index) => (
                    <span
                      key={`${object}-${index}`}
                      className="border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400"
                    >
                      {object}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  Nothing detected yet.
                </p>
              )}
            </div>

            <div className="border-t border-white/[0.06] pt-5">
              <p className="text-xs leading-5 text-slate-500">
                Incident reports, evidence and AI chat are available in the
                Incidents section after an incident has been recorded.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}