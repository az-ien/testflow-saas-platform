import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchRun } from '../features/runs/runsSlice';
import { CheckCircle2, XCircle, Clock, ChevronLeft, ExternalLink, Terminal } from 'lucide-react';

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const run = useAppSelector(s => s.runs.currentRun);
  const [activeTab, setActiveTab] = useState<'results' | 'logs'>('results');

  useEffect(() => {
    if (id) {
      dispatch(fetchRun(id));
      // Poll for status updates if run is active
      const interval = setInterval(() => {
        if (['queued','cloning','installing','running'].includes(run?.status)) {
          dispatch(fetchRun(id));
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [id, run?.status]);

  const formatDuration = (ms?: number | null) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  if (!run) return (
    <div className="flex items-center justify-center h-64 text-muted">Loading run details...</div>
  );

  const results = run.results || [];
  const logs = run.logs || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard/runs" className="text-muted hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Run Details</h1>
          <p className="text-muted text-xs font-mono mt-0.5">{run.id}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Status',   value: run.status,                             color: run.status === 'passed' ? '#10b981' : run.status === 'failed' ? '#ef4444' : '#6366f1' },
          { label: 'Passed',   value: run.summary?.passed ?? '—',             color: '#10b981' },
          { label: 'Failed',   value: run.summary?.failed ?? '—',             color: '#ef4444' },
          { label: 'Duration', value: formatDuration(run.durationMs),         color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <div className="text-xl font-bold capitalize" style={{ color }}>{value}</div>
            <div className="text-xs text-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Meta info */}
      <div className="card grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {[
          { label: 'Framework',   value: run.framework },
          { label: 'Branch',      value: run.branch || 'main' },
          { label: 'Triggered By', value: run.triggeredBy },
          { label: 'Commit',      value: run.commitSha ? run.commitSha.slice(0, 7) : '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-xs text-muted mb-1">{label}</div>
            <div className="font-medium capitalize">{value || '—'}</div>
          </div>
        ))}
      </div>

      {/* Report link */}
      {run.reportUrl && (
        <a href={run.reportUrl} target="_blank" rel="noreferrer"
          className="btn-secondary flex items-center gap-2 w-fit text-sm">
          <ExternalLink size={14} /> View HTML Report
        </a>
      )}

      {/* Tabs */}
      <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex gap-1">
          {(['results', 'logs'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-muted hover:text-white'
              }`}>
              {tab} {tab === 'results' ? `(${results.length})` : `(${logs.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Results tab */}
      {activeTab === 'results' && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="card text-center py-10 text-muted">No test results available</div>
          ) : results.map((r: any, i: number) => (
            <div key={i} className="card !p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {r.status === 'passed'
                  ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  : r.status === 'skipped'
                    ? <Clock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    : <XCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <div className="text-sm font-medium">{r.title}</div>
                  {r.error && (
                    <div className="text-xs text-red-400 mt-1 font-mono bg-red-500/5 px-2 py-1 rounded">
                      {r.error}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted flex-shrink-0">{r.duration}ms</div>
            </div>
          ))}
        </div>
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <Terminal size={14} className="text-muted" />
            <span className="text-xs text-muted">Execution Logs</span>
          </div>
          <pre className="p-4 text-xs font-mono overflow-auto max-h-96 leading-relaxed"
            style={{ color: '#a3e635' }}>
            {logs.length > 0 ? logs.join('\n') : 'No logs available'}
          </pre>
        </div>
      )}
    </div>
  );
}
