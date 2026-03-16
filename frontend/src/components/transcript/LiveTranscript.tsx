import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../../services/api";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
  confidence: number;
}

interface LiveTranscriptProps {
  campaignFolder: string;
  sessionId: string | null;
  maxEntries?: number;
  pollInterval?: number; // milliseconds, default 5000
  onEntryCount?: (count: number) => void;
}

const LiveTranscript: React.FC<LiveTranscriptProps> = ({
  campaignFolder,
  sessionId,
  maxEntries = 20,
  pollInterval = 5000,
  onEntryCount,
}) => {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll when new entries arrive
  const autoScroll = useCallback(() => {
    if (transcriptEndRef.current && isExpanded) {
      transcriptEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [isExpanded]);

  // Fetch latest transcript entries
  const fetchTranscript = useCallback(async () => {
    if (!sessionId) return;

    try {
      setIsLoading(true);
      const data = await api.get<TranscriptEntry[]>(
        `/transcripts/${campaignFolder}/sessions/${sessionId}`
      );

      // Keep only the last N entries
      const recent = data.slice(-maxEntries);
      setEntries(recent);
      setLastUpdate(new Date());
      onEntryCount?.(data.length);

      // Auto-scroll if expanded
      if (isExpanded) {
        setTimeout(autoScroll, 100);
      }
    } catch (error) {
      console.error("Failed to fetch transcript:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, campaignFolder, maxEntries, isExpanded, onEntryCount, autoScroll]);

  // Setup polling
  useEffect(() => {
    // Initial fetch
    fetchTranscript();

    // Setup polling
    pollIntervalRef.current = setInterval(fetchTranscript, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchTranscript, pollInterval]);

  if (!sessionId) {
    return null;
  }

  // Get speaker color (deterministic)
  const getSpeakerColor = (speaker: string): string => {
    const colors = [
      "bg-amber-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-cyan-500",
      "bg-lime-500",
      "bg-rose-500",
      "bg-indigo-500",
    ];
    const hash = speaker.charCodeAt(0) + speaker.charCodeAt(speaker.length - 1);
    return colors[hash % colors.length];
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString();
  };

  // Truncate text for compact display
  const truncateText = (text: string, maxLength: number = 120): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 border-t border-slate-700">
      {/* Header */}
      <div
        className="px-4 py-2 bg-slate-700 border-b border-slate-600 flex items-center justify-between cursor-pointer hover:bg-slate-600 transition"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Live Transcript</h3>
          {isLoading && (
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-slate-400">
              {formatRelativeTime(lastUpdate.toISOString())}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Transcript entries */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
          {entries.length === 0 ? (
            <div className="text-slate-500 text-center py-4">
              No transcript entries yet
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={idx}
                className="group bg-slate-700/50 rounded p-2 hover:bg-slate-700 transition"
              >
                <div className="flex gap-2 items-start">
                  <span
                    className={`${getSpeakerColor(
                      entry.speaker
                    )} text-white font-bold px-1.5 py-0.5 rounded flex-shrink-0 text-xs`}
                  >
                    {entry.speaker.substring(0, 3).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1 mb-0.5">
                      <span className="text-slate-400">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                      {entry.confidence < 0.8 && (
                        <span className="text-yellow-600">⚠</span>
                      )}
                    </div>
                    <p className="text-slate-200 break-words leading-tight">
                      {truncateText(entry.text)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  );
};

export default LiveTranscript;
