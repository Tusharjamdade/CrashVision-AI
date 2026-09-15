import { useCallback, useMemo, useState } from "react";
import type { FilterOptions, IncidentListResponse, IncidentRecord } from "../types";

const API_URL = "http://localhost:8000";

const MOCK_INCIDENTS: IncidentRecord[] = [
  {
    id: "inc-8f92a10c",
    record_id: "inc-8f92a10c",
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    status: "completed",
    accident: true,
    confidence: 0.962,
    objects: ["car", "truck", "debris"],
    report:
      "CRASHVISION ACCIDENT REPORT\n\nDate/Time: " +
      new Date(Date.now() - 1000 * 60 * 25).toLocaleString() +
      "\nLocation: Highway Intersection 4B\nClassification: High-Severity Vehicle Collision\nConfidence Score: 96.2%\n\nSummary:\nA high-speed collision between a commercial truck and sedan was detected by the YOLO vision pipeline. Rapid deceleration and debris scattering were confirmed in camera feed CAM-01.\n\nRecommended Action:\nDispatch emergency medical services (EMS) and highway patrol immediately.",
    video: {
      key: "incidents/videos/inc-8f92a10c.mp4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    },
    image: {
      key: "incidents/images/inc-8f92a10c.jpg",
      url: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80",
    },
  },
  {
    id: "inc-3e41b9d1",
    record_id: "inc-3e41b9d1",
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    status: "completed",
    accident: true,
    confidence: 0.884,
    objects: ["motorcycle", "car"],
    report:
      "CRASHVISION ACCIDENT REPORT\n\nDate/Time: " +
      new Date(Date.now() - 1000 * 60 * 180).toLocaleString() +
      "\nLocation: Main St & 5th Ave\nClassification: Side Collision\nConfidence Score: 88.4%\n\nSummary:\nSide-impact incident involving a sedan and motorcycle at urban traffic junction.",
    video: {
      key: "incidents/videos/inc-3e41b9d1.mp4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    },
    image: {
      key: "incidents/images/inc-3e41b9d1.jpg",
      url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80",
    },
  },
  {
    id: "inc-7d12f38a",
    record_id: "inc-7d12f38a",
    created_at: new Date(Date.now() - 1000 * 60 * 400).toISOString(),
    status: "processing",
    accident: true,
    confidence: 0.915,
    objects: ["bus", "car"],
    report: null,
    video: null,
    image: null,
  },
];

export function useIncidents() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>(MOCK_INCIDENTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);

  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: "",
    status: "all",
    minConfidence: 0,
    selectedTag: null,
    sortBy: "newest",
  });

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/records?limit=100&skip=0`);
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data: IncidentListResponse = await response.json();
      if (Array.isArray(data.records) && data.records.length > 0) {
        setIncidents(data.records);
      }
    } catch {
      // Keep mock data as fallback if backend is unreachable or empty
      console.warn("FastAPI backend unreached. Using interactive demo dataset.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openIncident = useCallback(
    async (id: string) => {
      if (!id) return;
      setDetailLoading(true);
      setError(null);

      // Check local existing list first for immediate snappy UI response
      const existing = incidents.find((i) => (i.record_id || i.id) === id);
      if (existing) {
        setSelectedIncident(existing);
      }

      try {
        const response = await fetch(
          `${API_URL}/api/records/${encodeURIComponent(id)}`
        );
        if (response.ok) {
          const fresh: IncidentRecord = await response.json();
          setSelectedIncident(fresh);
        }
      } catch (err) {
        console.warn("FastAPI detail fetch fallback:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [incidents]
  );

  // Extract all unique detected object tags across all loaded incidents
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    incidents.forEach((inc) => {
      if (Array.isArray(inc.objects)) {
        inc.objects.forEach((obj) => tagsSet.add(obj.toLowerCase()));
      }
    });
    return Array.from(tagsSet);
  }, [incidents]);

  // Filtered and sorted incidents list
  const filteredIncidents = useMemo(() => {
    return incidents
      .filter((incident) => {
        // Status filter
        if (filters.status !== "all" && incident.status !== filters.status) {
          return false;
        }

        // Confidence threshold
        if (incident.confidence < filters.minConfidence) {
          return false;
        }

        // Tag filter
        if (filters.selectedTag) {
          const objs = (incident.objects || []).map((o) => o.toLowerCase());
          if (!objs.includes(filters.selectedTag.toLowerCase())) {
            return false;
          }
        }

        // Text search (search in id, status, detected objects, report)
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const idMatch = (incident.record_id || incident.id).toLowerCase().includes(q);
          const objMatch = (incident.objects || []).some((o) =>
            o.toLowerCase().includes(q)
          );
          const reportMatch = (incident.report || "").toLowerCase().includes(q);
          return idMatch || objMatch || reportMatch;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (filters.sortBy === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (filters.sortBy === "highest_confidence") {
          return b.confidence - a.confidence;
        }
        return 0;
      });
  }, [incidents, filters]);

  return {
    incidents: filteredIncidents,
    rawIncidents: incidents,
    loading,
    error,
    selectedIncident,
    detailLoading,
    filters,
    allTags,
    setFilters,
    loadIncidents,
    openIncident,
    setSelectedIncident,
  };
}
