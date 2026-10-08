import React, { useEffect, useState } from 'react';
import { Server, Brain, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { BackendHealthData, MlHealthResponse } from '../types/index.ts';

export const ServiceStatus: React.FC = () => {
  const [backendData, setBackendData] = useState<BackendHealthData | null>(null);
  const [backendLoading, setBackendLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [mlData, setMlData] = useState<MlHealthResponse | null>(null);
  const [mlLoading, setMlLoading] = useState(true);
  const [mlError, setMlError] = useState<string | null>(null);

  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkHealth = async () => {
    setBackendLoading(true);
    setMlLoading(true);
    setBackendError(null);
    setMlError(null);

    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
    const mlUrl = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:8000';

    // Backend Check
    try {
      const res = await fetch(`${backendUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBackendData(json.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setBackendError(msg);
      setBackendData(null);
    } finally {
      setBackendLoading(false);
    }

    // ML Service Check
    try {
      const res = await fetch(`${mlUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMlData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setMlError(msg);
      setMlData(null);
    } finally {
      setMlLoading(false);
    }

    setLastChecked(new Date());
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">System Service Topology & Health</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status probes for core backend API and machine learning service
          </p>
        </div>
        <button
          onClick={checkHealth}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${backendLoading || mlLoading ? 'animate-spin' : ''}`}
          />
          <span>Check Now</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backend Card */}
        <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Core Backend API</h3>
                <p className="text-xs text-slate-400">Node.js + Express (TypeScript)</p>
              </div>
            </div>
            {backendLoading ? (
              <span className="text-xs text-slate-400 animate-pulse">Probing...</span>
            ) : backendData ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Operational
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Endpoint
              </span>
              <span className="font-mono text-slate-200 text-xs">/api/v1/health</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Uptime
              </span>
              <span className="font-mono text-slate-200 text-xs">
                {backendData ? `${backendData.uptimeSeconds}s` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Memory
              </span>
              <span className="font-mono text-slate-200 text-xs">
                {backendData ? `${backendData.memory.heapUsedMb} MB` : '—'}
              </span>
            </div>
          </div>
          {backendError && (
            <p className="mt-3 text-xs text-amber-400/90 font-mono bg-amber-950/20 p-2 rounded border border-amber-900/30">
              Note: {backendError} (start backend service with: npm run dev:backend)
            </p>
          )}
        </div>

        {/* ML Service Card */}
        <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/90 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Machine Learning Service</h3>
                <p className="text-xs text-slate-400">Python 3.10/3.11 (FastAPI)</p>
              </div>
            </div>
            {mlLoading ? (
              <span className="text-xs text-slate-400 animate-pulse">Probing...</span>
            ) : mlData ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Operational
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Endpoint
              </span>
              <span className="font-mono text-slate-200 text-xs">/health</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Uptime
              </span>
              <span className="font-mono text-slate-200 text-xs">
                {mlData ? `${mlData.uptimeSeconds}s` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                Version
              </span>
              <span className="font-mono text-slate-200 text-xs">
                {mlData ? mlData.version : '—'}
              </span>
            </div>
          </div>
          {mlError && (
            <p className="mt-3 text-xs text-amber-400/90 font-mono bg-amber-950/20 p-2 rounded border border-amber-900/30">
              Note: {mlError} (start ML service with: npm run dev:ml)
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>Auto-polling enabled on load</span>
        <span>Last probed: {lastChecked.toLocaleTimeString()}</span>
      </div>
    </section>
  );
};
