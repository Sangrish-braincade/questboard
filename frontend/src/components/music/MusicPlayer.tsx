/**
 * MusicPlayer — Ambient music/SFX player for the DM.
 * Streams audio to players via WebSocket commands.
 * Uses Howler.js for playback.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/services/api";
import type { WSMessage } from "@/types";

interface AudioTrack {
  name: string;
  filename: string;
  size_bytes: number;
  type: string;
  tags: string[];
}

interface MusicPlayerProps {
  campaignFolder: string;
  send: (msg: WSMessage) => void;
  isDm: boolean;
  className?: string;
}

export default function MusicPlayer({
  campaignFolder,
  send,
  isDm,
  className = "",
}: MusicPlayerProps) {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [filter, setFilter] = useState<string>("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch track list
  useEffect(() => {
    if (!campaignFolder) return;
    const loadTracks = async () => {
      try {
        const data = await api.get<AudioTrack[]>(`/audio/${campaignFolder}`);
        setTracks(data);
      } catch {
        // No audio directory yet
      }
    };
    loadTracks();
  }, [campaignFolder]);

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const playTrack = useCallback(
    async (trackName: string) => {
      try {
        // Fetch audio as b64
        const data = await api.get<{
          name: string;
          mime: string;
          data: string;
        }>(`/audio/${campaignFolder}/${trackName}`);

        // Create audio element with data URI
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(`data:${data.mime};base64,${data.data}`);
        audio.volume = volume;
        audio.loop = true;
        audioRef.current = audio;

        audio.play();
        setCurrentTrack(trackName);
        setPlaying(true);

        // Tell all players to play this track
        if (isDm) {
          send({
            type: "music_play",
            data: { track: trackName, campaign: campaignFolder },
          });
        }
      } catch (err) {
        console.error("[Music] Failed to play:", err);
      }
    },
    [campaignFolder, volume, isDm, send]
  );

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCurrentTrack(null);
    setPlaying(false);

    if (isDm) {
      send({ type: "music_stop", data: {} });
    }
  }, [isDm, send]);

  const togglePause = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setPlaying(true);
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const filteredTracks =
    filter === "all" ? tracks : tracks.filter((t) => t.type === filter);

  const trackTypes = ["all", ...new Set(tracks.map((t) => t.type))];

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Now Playing */}
      {currentTrack && (
        <div className="flex items-center gap-3 border-b border-[var(--color-surface-lighter)] bg-[var(--color-primary)]/5 px-3 py-2">
          <button
            onClick={togglePause}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
          >
            {playing ? "⏸" : "▶"}
          </button>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-[var(--color-text)]">
              {currentTrack}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {playing ? "Playing" : "Paused"}
            </p>
          </div>
          <button
            onClick={stopPlayback}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Stop
          </button>
        </div>
      )}

      {/* Volume */}
      <div className="flex items-center gap-2 border-b border-[var(--color-surface-lighter)] px-3 py-2">
        <span className="text-xs text-[var(--color-text-muted)]">Vol</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 accent-[var(--color-primary)]"
        />
        <span className="w-8 text-right text-xs text-[var(--color-text-muted)]">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Type filter */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-surface-lighter)] px-3 py-1.5">
        {trackTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs capitalize ${
              filter === type
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTracks.length === 0 ? (
          <p className="p-4 text-center text-xs text-[var(--color-text-muted)]">
            No audio tracks. Add .mp3/.ogg files to the campaign's audio folder.
          </p>
        ) : (
          filteredTracks.map((track) => (
            <button
              key={track.filename}
              onClick={() => playTrack(track.name)}
              className={`flex w-full items-center gap-3 border-b border-[var(--color-surface-lighter)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface)] ${
                currentTrack === track.name ? "bg-[var(--color-primary)]/10" : ""
              }`}
            >
              <span
                className={`text-xs ${
                  currentTrack === track.name && playing
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {currentTrack === track.name && playing ? "♫" : "♪"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-[var(--color-text)]">
                  {track.name}
                </p>
                <div className="flex gap-1.5">
                  <span className="text-xs text-[var(--color-text-muted)] capitalize">
                    {track.type}
                  </span>
                  {track.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-[var(--color-text-muted)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">
                {formatBytes(track.size_bytes)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
