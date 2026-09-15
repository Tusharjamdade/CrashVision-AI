export type Page = "home" | "monitor" | "incidents" | "diagnostics";

export interface IncidentMedia {
  key: string;
  url: string | null;
}

export interface IncidentRecord {
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

export interface IncidentListResponse {
  records: IncidentRecord[];
  total: number;
  limit: number;
  skip: number;
}

export interface MonitorMessage {
  type?: string;
  frame?: string;
  accident?: boolean;
  confidence?: number;
  objects?: string[];
  recording?: boolean;
  processing_incident?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface ChatResponse {
  conversation_id: string;
  response: string;
}

export interface FilterOptions {
  searchQuery: string;
  status: "all" | "completed" | "processing" | "failed";
  minConfidence: number;
  selectedTag: string | null;
  sortBy: "newest" | "oldest" | "highest_confidence";
}

export interface SystemMetrics {
  fps: number;
  latencyMs: number;
  connected: boolean;
  websocketStatus: "connected" | "connecting" | "disconnected";
  backendStatus: "online" | "offline";
  s3Status: "healthy" | "degraded";
  activeObjectsCount: number;
}

export interface User {
  username: string;
  email: string;
  full_name: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  username_or_email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}
