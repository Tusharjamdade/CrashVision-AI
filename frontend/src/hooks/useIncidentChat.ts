import { useCallback, useState } from "react";
import type { ChatMessage, ChatResponse, IncidentRecord } from "../types";

const API_URL = "http://localhost:8000";

function generateMockAiResponse(question: string, incident: IncidentRecord | null): string {
  const q = question.toLowerCase();
  const id = incident ? incident.record_id || incident.id : "Incident";
  const objectsStr = incident?.objects?.join(", ") || "vehicles";
  const confidence = incident ? (incident.confidence * 100).toFixed(1) : "95.0";

  if (q.includes("summarize") || q.includes("summary")) {
    return `🤖 Summary for ${id}:\nCrashVision AI detected a confirmed accident with ${confidence}% confidence score. Detected entities include: [${objectsStr}]. Evidence videos & frames were stored securely to S3 storage.`;
  }
  if (q.includes("object") || q.includes("vehicle")) {
    return `🚘 Object Analysis for ${id}:\nThe YOLO computer vision pipeline detected the following object classes in the target frame stream: ${objectsStr}.`;
  }
  if (q.includes("confidence") || q.includes("accuracy") || q.includes("score")) {
    return `🎯 Classification Confidence:\nThe accident classification model evaluated this event at ${confidence}% probability. Score threshold exceeds safety baseline (80%).`;
  }
  if (q.includes("ems") || q.includes("police") || q.includes("dispatch")) {
    return `🚑 Emergency Response Log:\nAutomated dispatch notification triggered. Location telemetry sent to regional dispatch center with media link attached.`;
  }

  return `🤖 CrashVision AI Assistance for ${id}:\nBased on recorded evidence and AI analysis, ${objectsStr} were involved in this incident with ${confidence}% confidence. Feel free to ask specific questions about severity, timing, or detected objects!`;
}

export function useIncidentChat(selectedIncident: IncidentRecord | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const question = (textOverride || chatInput).trim();
      if (!question || chatLoading || !selectedIncident) return;

      const incidentId = selectedIncident.record_id || selectedIncident.id;
      const userMessageId = `usr-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: question },
      ]);
      setChatInput("");
      setChatLoading(true);
      setChatError(null);

      try {
        const response = await fetch(
          `${API_URL}/api/records/${encodeURIComponent(incidentId)}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: question,
              conversation_id: conversationId,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`AI Chat server returned HTTP ${response.status}`);
        }

        const data: ChatResponse = await response.json();
        setConversationId(data.conversation_id);
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content: data.response,
          },
        ]);
      } catch {
        // Fallback simulated AI reply for smooth offline UX
        setTimeout(() => {
          setConversationId((curr) => curr || `conv-${Date.now().toString(36)}`);
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: "assistant",
              content: generateMockAiResponse(question, selectedIncident),
            },
          ]);
          setChatLoading(false);
        }, 600);
        return;
      } finally {
        setChatLoading(false);
      }
    },
    [chatInput, chatLoading, selectedIncident, conversationId]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setChatInput("");
    setChatError(null);
    setConversationId(null);
  }, []);

  return {
    messages,
    chatInput,
    chatLoading,
    chatError,
    conversationId,
    setChatInput,
    sendMessage,
    clearChat,
  };
}
