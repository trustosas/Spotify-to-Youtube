/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { 
  Upload, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Music, 
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  Loader2,
  Trash2,
  FileDown,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Track {
  name: string;
  artist: string;
  album: string;
  isrc: string;
  durationMs: number;
  url: string;
  albumImageUrl?: string;
  popularity?: number;
  trackPreviewUrl?: string;
}

interface MatchResult {
  source: Track;
  match: {
    videoId: string;
    name: string;
    artist: string;
    duration: number;
    thumbnails?: { url: string; width: number; height: number }[];
  } | null;
  tier: number;
  reason: string;
  status: 'success' | 'failed' | 'error';
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [results]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedTracks: Track[] = results.data.map((row: any) => {
            const trackUri = row['Track URI'] || row['uri'] || '';
            const id = trackUri.split(':').pop();

            return {
              name: row['Track Name'] || row['name'] || '',
              artist: row['Artist Name(s)'] || row['artist'] || '',
              album: row['Album Name'] || row['album'] || '',
              isrc: row['ISRC'] || row['isrc'] || '',
              durationMs: parseInt(row['Track Duration (ms)'] || row['Duration (ms)'] || row['duration_ms'] || '0'),
              url: trackUri.startsWith('spotify:track:') ? `https://open.spotify.com/track/${id}` : row['url'] || '',
              albumImageUrl: row['Album Image URL'] || '',
              popularity: parseInt(row['Popularity'] || '0'),
              trackPreviewUrl: row['Track Preview URL'] || ''
            };
          }).filter(t => t.name && t.artist);

          setTracks(parsedTracks);
          setResults([]);
          setError(null);
        } catch (err) {
          setError('Failed down. Ensure CSV matches Exportify schema.');
        }
      },
      error: (err) => {
        setError(`CSV Error: ${err.message}`);
      }
    });
  };

  const startMatching = async () => {
    if (tracks.length === 0) return;
    setIsMatching(true);
    setResults([]);
    setError(null);

    const batchSize = 15; // Increased batch size for speed
    const allResults: MatchResult[] = [];

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      try {
        const response = await fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tracks: batch })
        });

        if (!response.ok) throw new Error('API_SYNC_FAILED');
        
        const data = await response.json();
        allResults.push(...data.results);
        setResults([...allResults]);
        setMatchProgress(Math.round(((i + batch.length) / tracks.length) * 100));
      } catch (err) {
        setError('CRITICAL: Sync batch failure. Connectivity or Rate Limit.');
        break;
      }
    }
    setIsMatching(false);
  };

  const stats = useMemo(() => {
    const total = results.length;
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
    const verified = results.filter(r => r.tier === 1).length;

    return { total, success, failed, verified };
  }, [results]);

  const downloadConsolidatedReport = () => {
    if (results.length === 0) return;

    const csvData = results.map(r => ({
      'Sync Status': r.status === 'success' ? 'MATCHED' : 'UNVERIFIED',
      'Track Name': r.source.name,
      'Artist Name': r.source.artist,
      'Album Name': r.source.album,
      'ISRC': r.source.isrc,
      'Popularity': r.source.popularity,
      'Duration (ms)': r.source.durationMs,
      'Source URL': r.source.url,
      'Album Image': r.source.albumImageUrl,
      'Destination URL': r.match ? `https://music.youtube.com/watch?v=${r.match.videoId}` : 'N/A',
      'YTM Name': r.match?.name || 'N/A',
      'YTM Artist': r.match?.artist || 'N/A',
      'Engine Reason': r.reason
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GATEKEEPER_SYNC_REPORT_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#050506] text-emerald-500 font-mono selection:bg-emerald-500/30 overflow-x-hidden">
      {/* HUD Header */}
      <nav className="border-b border-emerald-500/20 bg-black/40 px-6 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <ShieldCheck className="w-5 h-5" />
          <h1 className="font-bold tracking-widest text-sm uppercase">GATEKEEPER // LOGIC_ONLY_MODE</h1>
        </div>
        <div className="flex items-center gap-4 text-[10px] opacity-60">
          <span>TX_READY</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module A: Process Control */}
        <div className="lg:col-span-4 space-y-6">
          <section className="border border-emerald-500/20 bg-black p-5 space-y-5">
            <div className="flex items-center gap-2 border-b border-emerald-500/10 pb-3">
              <Terminal className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-tighter">Command Input</span>
            </div>

            {!tracks.length ? (
              <div className="relative">
                <input type="file" accept=".csv, text/csv, application/vnd.ms-excel" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="border border-dashed border-emerald-500/30 py-10 flex flex-col items-center justify-center gap-2 hover:bg-emerald-500/5 transition-colors">
                  <Upload className="w-6 h-6 opacity-40" />
                  <span className="text-[10px] uppercase">Load Exportify CSV</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs bg-emerald-500/5 p-3 border border-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <Music className="w-3 h-3" />
                    <span>{tracks.length} OBJECTS_FOUND</span>
                  </div>
                  <button onClick={() => { setTracks([]); setResults([]); }} className="hover:text-red-500 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={startMatching}
                  disabled={isMatching}
                  className={cn(
                    "w-full py-3 border border-emerald-500 font-bold text-xs uppercase transition-all",
                    isMatching ? "opacity-30 cursor-not-allowed" : "hover:bg-emerald-500 hover:text-black"
                  )}
                >
                  {isMatching ? "Executing Gate_Sync..." : "Execute Matching Flow"}
                </button>
              </div>
            )}
          </section>

          {/* Stats HUD */}
          {results.length > 0 && (
            <section className="border border-emerald-500/20 bg-black p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-emerald-500/10 pb-3">
                <Database className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-tighter">State Registry</span>
              </div>
              
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span>METADATA_MATCHED:</span>
                  <span className="text-white">{stats.verified}</span>
                </div>
                <div className="flex justify-between">
                  <span>UNVERIFIED_GATE:</span>
                  <span className="text-amber-500">{stats.failed}</span>
                </div>
                <div className="w-full h-1 bg-emerald-500/10 mt-2">
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(stats.success / stats.total) * 100}%` }} />
                </div>
              </div>

              {!isMatching && stats.total > 0 && (
                <button
                  onClick={downloadConsolidatedReport}
                  className="w-full py-3 bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 text-[10px] font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <FileDown className="w-3 h-3" />
                  Export Sync Report ({stats.total})
                </button>
              )}
            </section>
          )}

          {error && (
            <div className="border border-red-500/50 bg-red-500/5 p-4 text-[10px] uppercase flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-3 h-3" />
              {error}
            </div>
          )}
        </div>

        {/* Module B: Logic Output Monitor */}
        <div className="lg:col-span-8 border border-emerald-500/20 bg-black flex flex-col h-[600px]">
          <header className="px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <Search className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Log Stream</span>
            </div>
            {isMatching && (
              <span className="text-[10px] animate-pulse">PROC_READY: {matchProgress}%</span>
            )}
          </header>

          <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {!results.length ? (
              <div className="h-full flex items-center justify-center opacity-20">
                <span className="text-[10px] uppercase tracking-[0.3em]">System_Idle_Waiting_For_Input</span>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((res, i) => (
                  <div key={i} className={cn(
                    "text-[10px] py-2 px-3 border-l-2 flex flex-wrap lg:flex-nowrap items-center gap-4 transition-colors",
                    res.status === 'success' ? "border-emerald-500 bg-emerald-500/5" : "border-amber-500 bg-amber-500/5"
                  )}>
                    <span className="opacity-40 uppercase w-8">[{String(i+1).padStart(3, '0')}]</span>
                    
                    <div className="flex items-center gap-3 min-w-[250px] flex-1">
                      {res.source.albumImageUrl ? (
                        <img 
                          src={res.source.albumImageUrl} 
                          alt={res.source.album} 
                          className="w-10 h-10 rounded-sm object-cover border border-emerald-500/20"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                          <Music className="w-4 h-4 opacity-30" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-white truncate font-bold text-[11px]">{res.source.name}</span>
                        <span className="opacity-60 truncate">{res.source.artist}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-30 mx-2 flex-shrink-0" />
                      {res.match && (
                        <div className="flex flex-col min-w-0">
                          <span className="text-emerald-400 truncate font-bold">{res.match.name}</span>
                          <span className="opacity-40 truncate text-[9px]">{res.match.artist}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "font-bold uppercase",
                          res.status === 'success' ? "text-emerald-500" : "text-amber-500"
                        )}>
                          {res.status === 'success' ? 'MATCH_OK' : 'FAIL'}
                        </span>
                        {res.match && (
                          <span className="opacity-40 text-[9px]">
                            Δ {Math.abs(res.match.duration - (res.source.durationMs / 1000)).toFixed(3)}s
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="opacity-40 max-w-[150px] truncate text-right text-[9px]">{res.reason}</span>
                        {res.status === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isMatching && (
                  <div className="text-[10px] opacity-40 animate-pulse py-1">
                    [SYSTEM]: READING_NEXT_BUFFER...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Meta */}
      <footer className="fixed bottom-0 left-0 right-0 px-6 py-2 border-t border-emerald-500/10 bg-black/80 backdrop-blur-sm flex justify-between text-[8px] font-mono opacity-40 tracking-widest uppercase">
        <span>Kernel_V: 1.0.4.ST-LOGIC</span>
        <span>Secure Tunnel Encrypted</span>
        <span>Process ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
      </footer>
    </div>
  );
}
