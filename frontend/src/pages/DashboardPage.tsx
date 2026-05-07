import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchRuns } from '../features/runs/runsSlice';
import { fetchProjects } from '../features/projects/projectsSlice';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { PlayCircle, CheckCircle2, XCircle, Clock, TrendingUp, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`badge-${status === 'passed' ? 'passed' : status === 'failed' ? 'failed' : status === 'running' ? 'running' : status === 'queued' ? 'queued' : 'error'}`}>
    {status}
  </span>
);

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { items: runs, loading: runsLoading } = useAppSelector(s => s.runs);
  const { items: projects } = useAppSelector(s => s.projects);
  const user = useAppSelector(s => s.auth.user);

  useEffect(() => {
    dispatch(fetchRuns({ limit: 50 }));
    dispatch(fetchProjects());
  }, []);

  const passed  = runs.filter(r => r.status === 'passed').length;
  const failed  = runs.filter(r => r.status === 'failed').length;
  const running = runs.filter(r => ['running', 'cloning', 'installing', 'queued'].includes(r.status)).length;
  const successRate = runs.length ? Math.round((passed / runs.length) * 100) : 0;

  // Last 7 days chart data
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayRuns = runs.filter(r => new Date(r.createdAt).toDateString() === d.toDateString());
    return {
      day: dayStr,
      passed: dayRuns.filter(r => r.status === 'passed').length,
      failed: dayRuns.filter(r => r.status === 'failed').length,
    };
  });

  const pieData = [
    { name: 'Passed', value: passed,  color: '#10b981' },
    { name: 'Failed', value: failed,  color: '#ef4444' },
    { name: 'Active', value: running, color: '#6366f1' },
  ].filter(d => d.value > 0);

  const stats = [
    { label: 'Total Runs',    value: runs.length, icon: PlayCircle,    color: '#6366f1' },
    { label: 'Passed',        value: passed,      icon: CheckCircle2,  color: '#10b981' },
    { label: 'Failed',        value: failed,      icon: XCircle,       color: '#ef4444' },
    { label: 'Success Rate',  value: `${successRate}%`, icon: TrendingUp, color: '#f59e0b' },
  ];

  const recentRuns = runs.slice(0, 8);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user?.firstName} 👋</h1>
        <p className="text-muted text-sm mt-1">
          {user?.monthlyRunsUsed || 0} / {user?.monthlyRunsLimit || 50} runs used this month
        </p>
      </div>

      {/* Usage bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Monthly Run Usage</span>
          <span className="text-xs text-muted capitalize">{user?.subscriptionTier} plan</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: 'var(--color-border)' }}>
          <div className="h-2 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(((user?.monthlyRunsUsed || 0) / (user?.monthlyRunsLimit || 50)) * 100, 100)}%`,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            }} />
        </div>
        <div className="flex justify-between text-xs text-muted mt-2">
          <span>{user?.monthlyRunsUsed || 0} used</span>
          <span>{(user?.monthlyRunsLimit || 50) - (user?.monthlyRunsUsed || 0)} remaining</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}15` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold mb-4 text-sm">Run Trends — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gPassed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="passed" stroke="#10b981" fill="url(#gPassed)" strokeWidth={2} />
              <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="url(#gFailed)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card flex flex-col">
          <h3 className="font-semibold mb-4 text-sm">Result Distribution</h3>
          {pieData.length > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <PieChart width={160} height={160}>
                <Pie data={pieData} cx={75} cy={75} innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="space-y-2 mt-4 w-full">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-muted">{d.name}</span>
                    </div>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">No runs yet</div>
          )}
        </div>
      </div>

      {/* Recent runs */}
      <div className="card">
        <h3 className="font-semibold mb-4 text-sm">Recent Runs</h3>
        {recentRuns.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <PlayCircle size={40} className="mx-auto mb-3 opacity-30" />
            <p>No test runs yet. Create a project and trigger your first run.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRuns.map(run => (
              <div key={run.id} className="flex items-center justify-between p-3 rounded-lg transition-colors"
                style={{ background: 'var(--color-surface2)' }}>
                <div className="flex items-center gap-3">
                  <StatusBadge status={run.status} />
                  <div>
                    <div className="text-sm font-medium">{run.project?.name || 'Unknown Project'}</div>
                    <div className="text-xs text-muted">{run.framework} · {run.branch || 'main'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">
                    {run.summary ? `${run.summary.passed}/${run.summary.total} passed` : '—'}
                  </div>
                  <div className="text-xs text-muted">
                    {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
