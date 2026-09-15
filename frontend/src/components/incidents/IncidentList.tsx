import React from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { CardSpotlight } from "../ui/CardSpotlight";
import { BentoGrid, BentoGridItem } from "../ui/BentoGrid";
import type { FilterOptions, IncidentRecord } from "../../types";

interface IncidentListProps {
  incidents: IncidentRecord[];
  allIncidentsCount: number;
  loading: boolean;
  error: string | null;
  filters: FilterOptions;
  allTags: string[];
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  onRefresh: () => void;
  onOpen: (id: string) => void;
}

export const IncidentList: React.FC<IncidentListProps> = ({
  incidents,
  allIncidentsCount,
  loading,
  error,
  filters,
  allTags,
  setFilters,
  onRefresh,
  onOpen,
}) => {
  const completedCount = incidents.filter((i) => i.status === "completed").length;
  const withMediaCount = incidents.filter((i) => i.video || i.image).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            Incidents Hub & Evidence Vault
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse, search, and analyze recorded accident streams and AI generated reports.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Database
        </button>
      </div>

      {/* Overview Bento Grid */}
      <BentoGrid className="max-w-none grid-cols-1 md:grid-cols-3">
        <BentoGridItem
          title="Total Recorded Incidents"
          description={`${allIncidentsCount} total accident records stored in MongoDB.`}
          icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}
          header={
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>Database Total</span>
              <span className="text-xl font-extrabold text-amber-400">
                {allIncidentsCount}
              </span>
            </div>
          }
        />
        <BentoGridItem
          title="Completed AI Reports"
          description={`${completedCount} records fully analyzed with LLM summaries.`}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          header={
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>Ready for Review</span>
              <span className="text-xl font-extrabold text-emerald-400">
                {completedCount}
              </span>
            </div>
          }
        />
        <BentoGridItem
          title="Media Evidence Archives"
          description={`${withMediaCount} incidents backed up to Amazon S3 storage.`}
          icon={<Video className="h-5 w-5 text-cyan-400" />}
          header={
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>S3 Archives</span>
              <span className="text-xl font-extrabold text-cyan-400">
                {withMediaCount}
              </span>
            </div>
          }
        />
      </BentoGrid>

      {/* Search & Tag Filter Toolbar */}
      <CardSpotlight className="space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              placeholder="Search by incident ID, object tag (e.g. car, truck), or keyword..."
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
              <Filter className="h-4 w-4 text-blue-400" />
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value as FilterOptions["status"],
                  }))
                }
                className="bg-transparent font-medium text-white outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">
                  All Statuses
                </option>
                <option value="completed" className="bg-slate-900">
                  Completed
                </option>
                <option value="processing" className="bg-slate-900">
                  Processing
                </option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  sortBy: e.target.value as FilterOptions["sortBy"],
                }))
              }
              className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300 outline-none cursor-pointer"
            >
              <option value="newest" className="bg-slate-900">
                Sort: Newest First
              </option>
              <option value="oldest" className="bg-slate-900">
                Sort: Oldest First
              </option>
              <option value="highest_confidence" className="bg-slate-900">
                Sort: Confidence Score
              </option>
            </select>
          </div>
        </div>

        {/* Tag Pills */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/5 overflow-x-auto">
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
              Filter by Tag:
            </span>
            <button
              onClick={() =>
                setFilters((prev) => ({ ...prev, selectedTag: null }))
              }
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                filters.selectedTag === null
                  ? "bg-blue-600 text-white"
                  : "border border-white/10 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    selectedTag: prev.selectedTag === tag ? null : tag,
                  }))
                }
                className={`rounded-lg px-2.5 py-1 text-[11px] font-mono font-medium transition ${
                  filters.selectedTag === tag
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                }`}
              >
                🏷️ {tag}
              </button>
            ))}
          </div>
        )}
      </CardSpotlight>

      {/* Error Message Alert */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-md">
          <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
            Querying MongoDB Incident Records...
          </div>
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-8 text-center backdrop-blur-md">
          <AlertTriangle className="h-10 w-10 text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-300">
            No matching incidents found
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            Try adjusting your search criteria or tag filters.
          </p>
        </div>
      ) : (
        /* Incidents List Grid */
        <div className="space-y-3">
          {incidents.map((incident) => {
            const incId = incident.record_id || incident.id;
            const dateStr = new Date(incident.created_at).toLocaleString();
            const confidencePct = (incident.confidence * 100).toFixed(1);

            return (
              <CardSpotlight
                key={incId}
                onClick={() => onOpen(incId)}
                className="cursor-pointer transition-all duration-200 hover:scale-[1.005] hover:border-blue-500/40 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Thumbnail & Main Info */}
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900 relative flex items-center justify-center">
                      {incident.image?.url ? (
                        <img
                          src={incident.image.url}
                          alt="Incident frame"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-slate-600" />
                      )}
                      {incident.video && (
                        <span className="absolute bottom-1 right-1 rounded bg-blue-600/90 px-1 py-0.5 text-[8px] font-bold text-white">
                          VIDEO
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-100 text-sm">
                          Incident {incId.slice(0, 10)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${
                            incident.status === "completed"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {incident.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {dateStr}
                        </span>
                      </div>

                      {/* Objects detected */}
                      {incident.objects && incident.objects.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {incident.objects.map((obj, i) => (
                            <span
                              key={`${obj}-${i}`}
                              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-300"
                            >
                              {obj}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Confidence & Action arrow */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-0 border-white/5">
                    <div className="text-left sm:text-right font-mono">
                      <p className="text-xs text-slate-500">ACCIDENT CONFIDENCE</p>
                      <p className="text-base font-extrabold text-blue-400">
                        {confidencePct}%
                      </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-blue-600/10 border border-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Review Details</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </CardSpotlight>
            );
          })}
        </div>
      )}
    </div>
  );
};
