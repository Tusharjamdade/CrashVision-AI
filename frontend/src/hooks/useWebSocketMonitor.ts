import { useCallback, useEffect, useRef, useState } from "react";
import type { MonitorMessage } from "../types";

const WS_URL = "ws://localhost:8000/ws/monitor";
const API_URL = "http://localhost:8000";

// Mock SVG/Canvas frame generator for demo mode when backend is offline
function generateDemoFrame(tick: number, isAccident: boolean): string {
  const width = 640;
  const height = 360;
  const carX = (tick * 12) % (width + 100) - 50;
  const alertGlow = isAccident ? "#ef4444" : "#3b82f6";
  const bgGridColor = "rgba(255,255,255,0.05)";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#0a0d14"/>
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${bgGridColor}" stroke-width="1"/>
      </pattern>
      <linearGradient id="road" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    <polygon points="120,360 220,160 420,160 520,360" fill="url(#road)"/>
    <line x1="320" y1="160" x2="320" y2="360" stroke="#f59e0b" stroke-width="3" stroke-dasharray="20 15"/>
    
    <!-- Vehicle 1 -->
    <rect x="${carX}" y="240" width="90" height="45" rx="8" fill="#3b82f6" stroke="${alertGlow}" stroke-width="2"/>
    <circle cx="${carX + 20}" cy="285" r="8" fill="#475569"/>
    <circle cx="${carX + 70}" cy="285" r="8" fill="#475569"/>
    
    <!-- Bounding Box -->
    <rect x="${carX - 5}" y="230" width="100" height="65" fill="none" stroke="${alertGlow}" stroke-width="2" stroke-dasharray="6 3"/>
    <text x="${carX}" y="222" fill="${alertGlow}" font-size="12" font-family="monospace" font-weight="bold">Car: ${(0.89 + (tick % 10) * 0.01).toFixed(2)}</text>
    
    ${
      isAccident
        ? `
      <polygon points="${carX + 45},220 ${carX + 130},235 290,260" fill="#ef4444" opacity="0.3"/>
      <text x="220" y="80" fill="#ef4444" font-size="22" font-family="sans-serif" font-weight="bold">⚠️ ACCIDENT DETECTED</text>
    `
        : ""
    }

    <!-- Overlay Telemetry -->
    <text x="20" y="30" fill="#94a3b8" font-size="12" font-family="monospace">CAM-01 [DEMO STREAM] • 1080p 30fps</text>
    <text x="500" y="30" fill="#10b981" font-size="12" font-family="monospace">● LIVE INFERENCE</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function useWebSocketMonitor() {
  const [connected, setConnected] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [accident, setAccident] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [objects, setObjects] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [processingIncident, setProcessingIncident] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsCalcRef = useRef(Date.now());
  const demoIntervalRef = useRef<number | null>(null);

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

  const stopDemoMode = useCallback(() => {
    if (demoIntervalRef.current !== null) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setDemoMode(false);
  }, []);

  const startDemoMode = useCallback(() => {
    closeWebSocket();
    setConnectionError(null);
    setDemoMode(true);
    setConnected(true);
    setMonitoring(true);

    let tick = 0;
    stopDemoMode();

    demoIntervalRef.current = window.setInterval(() => {
      tick++;
      const isAccidentSimulated = tick % 40 > 25;
      setAccident(isAccidentSimulated);
      setConfidence(isAccidentSimulated ? 0.94 : 0.05);
      setObjects(
        isAccidentSimulated
          ? ["car", "truck", "debris"]
          : ["car", "motorcycle"]
      );
      setRecording(isAccidentSimulated);
      setProcessingIncident(tick % 40 === 39);
      setFrame(generateDemoFrame(tick, isAccidentSimulated));
      setFps(28 + (tick % 4));
    }, 150);
  }, [closeWebSocket, stopDemoMode]);

  const startMonitoring = useCallback(() => {
    stopDemoMode();
    closeWebSocket();

    setConnectionError(null);
    setFrame(null);
    setAccident(false);
    setConfidence(0);
    setObjects([]);
    setRecording(false);
    setProcessingIncident(false);

    try {
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
            typeof data.confidence === "number" && Number.isFinite(data.confidence)
              ? data.confidence
              : 0;

          setConfidence(Math.min(Math.max(nextConfidence, 0), 1));
          setObjects(Array.isArray(data.objects) ? data.objects : []);
          setRecording(data.recording ?? false);
          setProcessingIncident(data.processing_incident ?? false);

          // FPS computation
          frameCountRef.current++;
          const now = Date.now();
          if (now - lastFpsCalcRef.current >= 1000) {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
            lastFpsCalcRef.current = now;
          }
        } catch (error) {
          console.error("Invalid WebSocket frame:", error);
        }
      };

      socket.onerror = () => {
        setConnected(false);
        setMonitoring(false);
        setConnectionError(
          "Backend camera offline. Click 'Demo Feed' to test UI visuals!"
        );
      };

      socket.onclose = () => {
        setConnected(false);
        setMonitoring(false);
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
      };
    } catch {
      setConnectionError("Failed to initiate WebSocket connection.");
    }
  }, [closeWebSocket, stopDemoMode]);

  const stopMonitoring = useCallback(async () => {
    if (demoMode) {
      stopDemoMode();
      setConnected(false);
      setMonitoring(false);
      setFrame(null);
      setAccident(false);
      setConfidence(0);
      setObjects([]);
      return;
    }

    try {
      await fetch(`${API_URL}/api/stop`, { method: "POST" });
    } catch (error) {
      console.error("Error stopping backend monitor:", error);
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
  }, [closeWebSocket, demoMode, stopDemoMode]);

  useEffect(() => {
    return () => {
      closeWebSocket();
      stopDemoMode();
    };
  }, [closeWebSocket, stopDemoMode]);

  return {
    connected,
    monitoring,
    demoMode,
    frame,
    accident,
    confidence,
    objects,
    recording,
    processingIncident,
    connectionError,
    fps,
    startMonitoring,
    stopMonitoring,
    startDemoMode,
    setConnectionError,
  };
}
