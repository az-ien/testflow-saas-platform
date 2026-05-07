import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsAPI } from '../services/api';
import { useAppDispatch } from '../hooks';
import { triggerRun } from '../features/runs/runsSlice';
import { ChevronLeft, Play, GitBranch, Settings, BarChart3 } from 'lucide-react';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const [project, setProject] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    if (!id) return;
    projectsAPI.get(id).then(r => setProject(r.data)).catch(console.error);
    projectsAPI.getStats(id).then(r => setStats(r.data)).catch(console.error);
  }, [id]);

  const handleRun = async () => {
    if (!id) return;
    setTriggering(true);
    await dispatch(triggerRun({ projectId: id }));
    setTriggering(false);
  };

  if (!project) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  const runs = project.runs || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/projects" className="text-muted hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <p className="text-muted text-xs mt-0.5 capitalize">{project.framework} · {project.repoProvider}</p>
          </div>
        </div>
        <button onClick={handleRun} disabled={triggering} className="btn-primary flex items-center gap-2">
          <Play size={14} /> {triggering ? 'Queuing...' : 'Run Now'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Runs',    value: stats.total },
            { label: 'Passed',        value: stats.passed,      color: '#10b981' },
            { label: 'Failed',        value: stats.failed,      color: '#ef4444' },
            { label: 'Success Rate',  value: `${stats.successRate}%`, color: stats.successRate >= 80 ? '#10b981' : '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center">
              <div className="text-2xl font-bold" style={{ color: color || 'var(--color-text)' }}>{value}</div>
              <div className="text-xs text-muted mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Config */}
      <div className="card">
        <h3 className="font-semibold mb-4 text-sm flex items-center gap-2"><Settings size={14} /> Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Repository', value: project.repoUrl },
            { label: 'Branch',     value: project.repoBranch || 'main' },
            { label: 'Framework',  value: project.framework },
            { label: 'Pattern',    value: project.testPattern || '**/*.spec.ts' },
            { label: 'Webhook',    value: project.webhookUrl || 'Not configured' },
            { label: 'Active',     value: project.isActive ? 'Yes' : 'No' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-muted mb-1">{label}</div>
              <div className="font-medium truncate">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent runs */}
      <div className="card">
        <h3 className="font-semibold mb-4 text-sm flex items-center gap-2"><BarChart3 size={14} /> Recent Runs</h3>
        {runs.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">No runs yet</div>
        ) : (
          <div className="space-y-2">
            {runs.map((run: any) => (
              <Link key={run.id} to={`/dashboard/runs/${run.id}`}
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-white/5"
                style={{ background: 'var(--color-surface2)' }}>
                <div className="flex items-center gap-3">
                  <span className={`badge-${run.status}`}>{run.status}</span>
                  <span className="text-xs text-muted">{run.branch || 'main'}</span>
                </div>
                <div className="text-xs text-muted">
                  {run.summary ? `${run.summary.passed}/${run.summary.total}` : '—'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
