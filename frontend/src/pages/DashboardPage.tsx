import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchQeSummary } from '../features/qe/qeSlice';
import { ClipboardList, Brain, ShieldCheck, FileCode2, Sparkles, PieChart, PlayCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { summary, loading } = useAppSelector(s => s.qe);
  const user = useAppSelector(s => s.auth.user);

  useEffect(() => { dispatch(fetchQeSummary()); }, []);

  const cards = [
    { label: 'Requirements', value: summary?.requirements ?? 0, icon: ClipboardList, to: '/dashboard/requirements', color: '#6366f1' },
    { label: 'Scenarios', value: summary?.scenarios ?? 0, icon: Brain, to: '/dashboard/scenarios', color: '#8b5cf6' },
    { label: 'Verified', value: summary?.verifiedScenarios ?? 0, icon: ShieldCheck, to: '/dashboard/approvals', color: '#10b981' },
    { label: 'Generated tests', value: summary?.generatedTests ?? 0, icon: FileCode2, to: '/dashboard/generated', color: '#38bdf8' },
    { label: 'Pass rate', value: `${summary?.passRate ?? 0}%`, icon: PlayCircle, to: '/dashboard/runs', color: '#f59e0b' },
    { label: 'Healing', value: summary?.healingAttempts ?? 0, icon: Sparkles, to: '/dashboard/healing', color: '#ec4899' },
    { label: 'Coverage', value: `${summary?.coveragePercent ?? 0}%`, icon: PieChart, to: '/dashboard/coverage', color: '#14b8a6' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Quality Engineering, {user?.firstName}</h1>
        <p className="text-muted text-sm mt-1">
          Requirement → explore → plan → validate → approve → generate → execute → heal
        </p>
      </div>

      {loading && <div className="text-muted text-sm">Loading quality summary...</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, to, color }) => (
          <Link key={label} to={to} className="card flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4 text-sm">Recent AI activity</h3>
        {!summary?.recentActivity?.length ? (
          <p className="text-muted text-sm">No AI activity yet. Create a project, add a requirement, and start an AI test plan.</p>
        ) : (
          <div className="space-y-2">
            {summary.recentActivity.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-surface2)' }}>
                <div>
                  <div className="text-sm font-medium">{item.action.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-muted">{item.actor} · {item.entityType || 'workflow'}</div>
                </div>
                <div className="text-xs text-muted">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
