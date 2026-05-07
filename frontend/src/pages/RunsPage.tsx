import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchRuns } from '../features/runs/runsSlice';
import { Play, CheckCircle2, XCircle, Clock, ChevronRight, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_ICON: Record<string, React.ReactNode> = {
  passed:     <CheckCircle2 size={15} className="text-emerald-400" />,
  failed:     <XCircle size={15} className="text-red-400" />,
  queued:     <Clock size={15} className="text-blue-400" />,
  running:    <RefreshCw size={15} className="text-amber-400 animate-spin" />,
  cloning:    <RefreshCw size={15} className="text-indigo-400 animate-spin" />,
  installing: <RefreshCw size={15} className="text-purple-400 animate-spin" />,
  error:      <XCircle size={15} className="text-orange-400" />,
  cancelled:  <XCircle size={15} className="text-gray-400" />,
};

export default function RunsPage() {
  const dispatch = useAppDispatch();
  const { items: runs, loading } = useAppSelector(s => s.runs);

  useEffect(() => { dispatch(fetchRuns({ limit: 100 })); }, []);

  const formatDuration = (ms?: number | null) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Runs</h1>
          <p className="text-muted text-sm mt-1">All test executions across your projects</p>
        </div>
        <button onClick={() => dispatch(fetchRuns({ limit: 100 }))}
          className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading && <div className="text-center text-muted py-10">Loading runs...</div>}

      {!loading && runs.length === 0 && (
        <div className="card text-center py-16">
          <Play size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="font-semibold mb-2">No runs yet</h3>
          <p className="text-muted text-sm">Go to Projects and click "Run Now" to trigger your first test run.</p>
        </div>
      )}

      {runs.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)' }}>
                {['Status', 'Project', 'Framework', 'Branch', 'Results', 'Duration', 'Triggered', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={run.id}
                  className="border-b transition-colors hover:bg-white/[0.02] cursor-pointer"
                  style={{ borderColor: i === runs.length - 1 ? 'transparent' : 'var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {STATUS_ICON[run.status] || <Clock size={15} />}
                      <span className="capitalize text-xs">{run.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {run.project?.name || <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted capitalize">{run.framework || '—'}</td>
                  <td className="px-4 py-3 text-muted">{run.branch || 'main'}</td>
                  <td className="px-4 py-3">
                    {run.summary ? (
                      <span className="text-xs">
                        <span className="text-emerald-400">{run.summary.passed}</span>
                        <span className="text-muted"> / {run.summary.total}</span>
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{formatDuration(run.durationMs)}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/runs/${run.id}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-indigo-500/10"
                      style={{ background: 'var(--color-surface2)' }}>
                      <ChevronRight size={14} className="text-muted" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
