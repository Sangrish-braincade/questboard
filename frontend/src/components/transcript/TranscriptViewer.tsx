import React, { useEffect, useState, useRef } from "react";
import { api } from "../../services/api";
import { ChevronDown, Search, Download, MoreVertical } from "lucide-react";

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
  confidence: number;
}

interface SessionListing {
  session_id: string;
  date: string;
  campaign: string;
  entry_count: number;
  speakers: string[];
  duration_minutes: number;
}

interface SearchResult extends TranscriptEntry {
  session_id: string;
}

const TranscriptViewer: React.FC<{ campaignFolder: string }> = ({
  campaignFolder,
}) => {
  // Session management
  const [sessions, setSessions] = useState<SessionListing[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [loadingSession, setLoadingSession] = useState(false);

  // Transcript data
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [allSpeakers, setAllSpeakers] = useState<string[]>([]);
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(
    new Set()
  );

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // UI state
  const [showSpeakerFilter, setShowSpeakerFilter] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await api.get<SessionListing[]>(
          `/transcripts/${campaignFolder}/sessions`
        );
        setSessions(data);
        if (data.length > 0) {
          setSelectedSessionId(data[0].session_id);
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
      }
    };
    loadSessions();
  }, [campaignFolder]);

  // Load transcript when session changes
  useEffect(() => {
    if (!selectedSessionId) return;

    const loadTranscript = async () => {
      setLoadingSession(true);
      try {
        const data = await api.get<TranscriptEntry[]>(
          `/transcripts/${campaignFolder}/sessions/${selectedSessionId}`
        );
        setTranscript(data);
        setShowSearchResults(false);
        setSearchQuery("");

        // Extract unique speakers
        const speakers = Array.from(new Set(data.map((t) => t.speaker)));
        setAllSpeakers(speakers);
        setSelectedSpeakers(new Set(speakers));
      } catch (error) {
        console.error("Failed to load transcript:", error);
      } finally {
        setLoadingSession(false);
      }
    };
    loadTranscript();
  }, [selectedSessionId, campaignFolder]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript, autoScroll, showSearchResults]);

  // Search handler
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const data = await api.get<SearchResult[]>(
        `/transcripts/${campaignFolder}/search?q=${encodeURIComponent(query)}`
      );
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle speaker filter
  const toggleSpeaker = (speaker: string) => {
    const newSpeakers = new Set(selectedSpeakers);
    if (newSpeakers.has(speaker)) {
      newSpeakers.delete(speaker);
    } else {
      newSpeakers.add(speaker);
    }
    setSelectedSpeakers(newSpeakers);
  };

  // Export transcript
  const handleExport = (format: "txt" | "md") => {
    const displayed = showSearchResults ? searchResults : transcript;
    const filtered =
      selectedSpeakers.size > 0
        ? displayed.filter((t) => selectedSpeakers.has(t.speaker))
        : displayed;

    let content = "";
    if (format === "md") {
      content = `# Session Transcript\n\n`;
      filtered.forEach((entry) => {
        const date = new Date(entry.timestamp).toLocaleString();
        content += `**${entry.speaker}** *(${date})*\n\n${entry.text}\n\n`;
      });
    } else {
      filtered.forEach((entry) => {
        const date = new Date(entry.timestamp).toLocaleString();
        content += `[${date}] ${entry.speaker}: ${entry.text}\n\n`;
      });
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${selectedSessionId}-${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter transcript entries
  const filteredTranscript = (showSearchResults ? searchResults : transcript)
    .filter((entry) => selectedSpeakers.size === 0 || selectedSpeakers.has(entry.speaker));

  // Format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

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

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="flex h-screen bg-slate-900 text-slate-50">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">No Transcripts Yet</h2>
            <p className="text-slate-400 mb-6">
              Session transcripts will appear here once you set up the Discord bot integration.
            </p>
            <div className="bg-slate-800 rounded-lg p-6 text-left text-sm">
              <p className="font-semibold mb-3 text-amber-400">To get started:</p>
              <ol className="space-y-2 text-slate-300">
                <li>1. Invite the Questboard bot to your Discord server</li>
                <li>2. Run <code className="bg-slate-900 px-2 py-1 rounded">/transcript start</code> in your session voice channel</li>
                <li>3. Have your session — transcripts appear here in real-time</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-50">
      {/* Sidebar - Sessions */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-sm">Sessions</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.session_id}
              onClick={() => setSelectedSessionId(session.session_id)}
              className={`w-full text-left px-4 py-3 border-b border-slate-700 hover:bg-slate-700 transition ${
                selectedSessionId === session.session_id ? "bg-slate-700" : ""
              }`}
            >
              <div className="font-medium text-sm">{session.campaign}</div>
              <div className="text-xs text-slate-400 mt-1">
                {new Date(session.date).toLocaleDateString()}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>{session.duration_minutes}m</span>
                <span>{session.entry_count} entries</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {session.speakers.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="text-xs bg-slate-600 px-1.5 py-0.5 rounded"
                  >
                    {s}
                  </span>
                ))}
                {session.speakers.length > 3 && (
                  <span className="text-xs text-slate-400">
                    +{session.speakers.length - 3}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search transcripts..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-slate-700 text-slate-50 rounded px-3 py-2 pl-9 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowSpeakerFilter(!showSpeakerFilter)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-50 rounded px-3 py-2 text-sm flex items-center gap-2 transition"
            >
              <span>Speakers ({selectedSpeakers.size})</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showSpeakerFilter && (
              <div className="absolute right-0 mt-2 bg-slate-700 rounded shadow-lg z-10 min-w-48 border border-slate-600">
                <div className="p-2">
                  {allSpeakers.map((speaker) => (
                    <label
                      key={speaker}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-600 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSpeakers.has(speaker)}
                        onChange={() => toggleSpeaker(speaker)}
                        className="rounded"
                      />
                      <span className="text-sm">{speaker}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative group">
            <button className="bg-slate-700 hover:bg-slate-600 text-slate-50 rounded px-3 py-2 text-sm transition">
              <Download className="w-4 h-4" />
            </button>
            <div className="absolute right-0 mt-2 bg-slate-700 rounded shadow-lg z-10 hidden group-hover:block border border-slate-600">
              <button
                onClick={() => handleExport("txt")}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-600 rounded-t"
              >
                Download as TXT
              </button>
              <button
                onClick={() => handleExport("md")}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-600 rounded-b"
              >
                Download as Markdown
              </button>
            </div>
          </div>
        </div>

        {/* Transcript area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loadingSession ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">Loading transcript...</p>
            </div>
          ) : filteredTranscript.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">
                {selectedSpeakers.size > 0
                  ? "No entries for selected speakers"
                  : showSearchResults
                    ? "No search results"
                    : "No transcript entries"}
              </p>
            </div>
          ) : (
            filteredTranscript.map((entry, idx) => (
              <div key={idx} className="group">
                <div className="flex gap-3 items-start">
                  <span
                    className={`${getSpeakerColor(
                      entry.speaker
                    )} text-white text-xs font-semibold px-2.5 py-1 rounded flex-shrink-0 mt-0.5`}
                  >
                    {entry.speaker}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs text-slate-400">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                      {entry.confidence < 0.8 && (
                        <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                          Low confidence
                        </span>
                      )}
                    </div>
                    <p className="text-slate-100 break-words">{entry.text}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Bottom bar */}
        {!autoScroll && (
          <div className="bg-slate-800 border-t border-slate-700 px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">Scrolling paused</span>
            <button
              onClick={() => {
                setAutoScroll(true);
                transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white rounded px-4 py-1 text-sm transition"
            >
              Jump to Latest
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptViewer;
