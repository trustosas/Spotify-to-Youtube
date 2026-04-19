/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Upload, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Download, 
  Music, 
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  Loader2,
  Trash2,
  FileDown
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
  artworkUrl?: string;
}

interface MatchResult {
  source: Track;
  match: {
    videoId: string;
    name: string;
    artist: string;
    duration: number;
    thumbnails: { url: string; width: number; height: number; }[];
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedTracks: Track[] = results.data.map((row: any) => ({
            name: row['Track Name'] || row['name'] || '',
            artist: row['Artist Name(s)'] || row['artist'] || '',
            album: row['Album Name'] || row['album'] || '',
            isrc: row['ISRC'] || row['isrc'] || '',
            durationMs: parseInt(row['Duration (ms)'] || row['duration_ms'] || '0'),
            artworkUrl: row['Album Artwork URL'] || row['artwork_url'] || ''
          })).filter(t => t.name && t.artist);

          setTracks(parsedTracks);
          setResults([]);
          setError(null);
        } catch (err) {
          setError('Failed to parse CSV. Ensure it follows the Exportify format.');
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

    // In a real Vercel app, we'd batch this to avoid timeouts.
    // For this prototype, we'll send in batches of 10.
    const batchSize = 10;
    const allResults: MatchResult[] = [];

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      try {
        const response = await fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tracks: batch })
        });

        if (!response.ok) throw new Error('Matching API failed');
        
        const data = await response.json();
        allResults.push(...data.results);
        setResults([...allResults]);
        setMatchProgress(Math.round(((i + batch.length) / tracks.length) * 100));
      } catch (err) {
        setError('Batch matching failed. The server might be rate limited.');
        break;
      }
    }
    setIsMatching(false);
  };

  const stats = useMemo(() => {
    const total = results.length;
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
    const tier1 = results.filter(r => r.tier === 1).length;
    const tier2 = results.filter(r => r.tier === 2).length;

    return { total, success, failed, tier1, tier2 };
  }, [results]);

  const downloadShoppingList = () => {
    const failures = results.filter(r => r.status === 'failed' || r.status === 'error');
    if (failures.length === 0) return;

    const csvData = failures.map(r => ({
      'Track Name': r.source.name,
      'Artist Name': r.source.artist,
      'Album Name': r.source.album,
      'ISRC': r.source.isrc,
      'Duration (ms)': r.source.durationMs,
      'Artwork URL': r.source.artworkUrl,
      'Reason': r.reason
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `shopping_list_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-gray-300 font-sans selection:bg-emerald-500/30">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Navigation / Header */}
      <nav className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <ShieldCheck className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight text-lg leading-none">GATEKEEPER</h1>
            <p className="text-[10px] font-mono text-emerald-500/80 mt-1 uppercase tracking-widest">High-Fidelity Sync Engine v1.0.4</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono opacity-40 uppercase">System Status</span>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono text-emerald-500 uppercase">Operational</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: controls & Stats */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-[#111113] border border-white/5 rounded-xl p-6 shadow-2xl">
            <header className="flex items-center gap-2 mb-6 text-white uppercase tracking-tighter font-semibold opacity-80">
              <Database className="w-4 h-4 text-emerald-500" />
              Ingestion Module
            </header>

            <div className="space-y-4">
              {!tracks.length ? (
                <div className="relative group">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-8 flex flex-col items-center justify-center gap-3 group-hover:border-emerald-500/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                      <Upload className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-white font-medium">Upload Exportify CSV</p>
                      <p className="text-xs text-gray-500 mt-1">ISRC, Name, Artist, Duration</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-lg p-4 flex items-center justify-between border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-emerald-500/20 flex items-center justify-center">
                        <Music className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{tracks.length} Tracks Loaded</p>
                        <p className="text-[10px] font-mono text-gray-500 uppercase">Input Catalog Ready</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setTracks([]); setResults([]); }}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={startMatching}
                    disabled={isMatching}
                    className={cn(
                      "w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-lg",
                      isMatching 
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                        : "bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.98]"
                    )}
                  >
                    {isMatching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        COMMENCING VERIFICATION...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-black" />
                        RUN GATEKEEPER FLOW
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>

          {stats.total > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111113] border border-white/5 rounded-xl p-6 shadow-2xl"
            >
              <header className="flex items-center gap-2 mb-6 text-white uppercase tracking-tighter font-semibold opacity-80">
                <Zap className="w-4 h-4 text-emerald-500" />
                Processing Stats
              </header>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Pass Rate</span>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-emerald-500">{Math.round((stats.success / stats.total) * 100)}%</span>
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Tier 1 (ISRC)</span>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">{stats.tier1}</span>
                    <span className="text-[10px] font-mono text-gray-500 mb-1">Tracks</span>
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Tier 2 (Fuzzy)</span>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">{stats.tier2}</span>
                    <span className="text-[10px] font-mono text-gray-500 mb-1">Tracks</span>
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Actionable</span>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-amber-500">{stats.failed}</span>
                    <span className="text-[10px] font-mono text-gray-500 mb-1">Local</span>
                  </div>
                </div>
              </div>

              {stats.failed > 0 && !isMatching && (
                <button
                  onClick={downloadShoppingList}
                  className="mt-6 w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 text-white text-xs font-bold transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  EXPORT SHOPPING LIST (.CSV)
                </button>
              )}
            </motion.section>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Right Column: Comparison Gird */}
        <div className="lg:col-span-8 flex flex-col min-h-[600px]">
          <div className="flex-1 bg-[#111113] border border-white/5 rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <header className="px-6 py-4 bg-black/40 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-500" />
                <span className="text-white uppercase tracking-tighter font-semibold opacity-80">Verification Monitor</span>
              </div>
              {isMatching && (
                <div className="flex items-center gap-3">
                  <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500" 
                      initial={{ width: 0 }}
                      animate={{ width: `${matchProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-500">{matchProgress}%</span>
                </div>
              )}
            </header>

            <div className="flex-1 overflow-auto">
              {!results.length ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 p-12 text-center opacity-40">
                  <div className="w-16 h-16 border-2 border-dashed border-current rounded-full flex items-center justify-center mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-mono uppercase tracking-widest">Awaiting Initialization</p>
                  <p className="text-xs mt-2 max-w-xs capitalize">Upload your Exportify CSV to begin matching tracks against the YouTube Music catalog.</p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <AnimatePresence>
                    {results.map((res, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="bg-white/[0.02] border border-white/5 rounded-lg p-5 group hover:border-emerald-500/30 transition-all duration-300"
                      >
                        <div className="flex flex-col gap-5">
                          {/* Header: Status Badges */}
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div className="flex items-center gap-3">
                              {res.status === 'success' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  MATCHED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider">
                                  <XCircle className="w-3.5 h-3.5" />
                                  SHOPPING LIST
                                </span>
                              )}
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono px-3 py-1 rounded border capitalize font-bold",
                              res.tier === 1 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                              res.tier === 2 ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                              "bg-red-500/10 border-red-500/20 text-red-500"
                            )}>
                              {res.tier > 0 ? `Gate Tier ${res.tier}` : 'Gate Failed'}
                            </span>
                          </div>

                          {/* Source and Target Comparison: Vertical Stack */}
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">
                            {/* Source Section */}
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 rounded-lg bg-white/5 overflow-hidden shrink-0 border border-white/10 shadow-lg">
                                {res.source.artworkUrl ? (
                                  <img src={res.source.artworkUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Music className="w-6 h-6 opacity-20" /></div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block mb-1">SOURCE: SPOTIFY</span>
                                <p className="text-base text-white font-semibold truncate leading-tight mb-0.5">{res.source.name}</p>
                                <p className="text-xs text-gray-400 truncate">{res.source.artist}</p>
                              </div>
                            </div>

                            {/* Center Connector */}
                            <div className="flex flex-col items-center justify-center">
                              <div className="md:w-0.5 md:h-8 w-full h-px bg-white/10 rounded-full my-2 md:my-0" />
                              <div className="p-1 rounded-full bg-[#111113] border border-white/5 md:rotate-0 rotate-90">
                                <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                              </div>
                              <div className="md:w-0.5 md:h-8 w-full h-px bg-white/10 rounded-full my-2 md:my-0" />
                            </div>

                            {/* Target Section */}
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/5">
                                {res.match ? (
                                  <img src={res.match.thumbnails[0]?.url} alt="" className="w-full h-full object-cover rounded-md opacity-90" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Search className="w-6 h-6 text-red-500/20" /></div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-mono text-emerald-500/50 uppercase tracking-widest block mb-1">TARGET: YT MUSIC</span>
                                {res.match ? (
                                  <>
                                    <p className="text-base text-emerald-500/90 font-semibold truncate leading-tight mb-0.5">{res.match.name}</p>
                                    <p className="text-[10px] text-emerald-500/50 truncate uppercase font-mono tracking-tighter">
                                      {Math.abs(res.match.duration - (res.source.durationMs / 1000)).toFixed(3)}s Δ • {res.match.artist}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-xs text-red-500/50 italic py-1 font-medium bg-red-500/5 px-2 rounded mt-1">Catalog matching unsuccessful</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Footer: Analysis Reason */}
                          <div className="mt-2 pt-3 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className={cn("w-3 h-3", res.status === 'success' ? "text-emerald-500/40" : "text-amber-500/40")} />
                              <span className="text-[10px] font-mono text-gray-500 uppercase">Engine Log: {res.reason}</span>
                            </div>
                            {res.match && (
                              <a 
                                href={`https://music.youtube.com/watch?v=${res.match.videoId}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="group/link flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 font-bold transition-all bg-emerald-500/5 px-3 py-1.5 rounded-md hover:bg-emerald-500/10"
                              >
                                <span>VERIFY ON PLATFORM</span>
                                <ArrowRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between px-2">
             <div className="flex items-center gap-6 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500" />
                 <span>Tier 1: ISRC Search</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-500" />
                 <span>Tier 2: Fuzzy Metadata</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-amber-500" />
                 <span>FallBack: Duration Delta &gt; 2s</span>
               </div>
             </div>
             <p className="text-[10px] font-mono text-gray-600">Secure Transmission Protocol Enabled</p>
          </div>
        </div>
      </main>
    </div>
  );
}
