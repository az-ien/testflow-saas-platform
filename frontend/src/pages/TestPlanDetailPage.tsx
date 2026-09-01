import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { approvalsAPI, testPlansAPI } from '../services/api';
import { ChevronLeft } from 'lucide-react';

const classBadge = (value?: string) => {
  if (value === 'VERIFIED') return 'badge-verified';
  if (value === 'UNSUPPORTED') return 'badge-unsupported';
  return 'badge-review';
};

export default function TestPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    testPlansAPI.get(id).then(({ data }) => setPlan(data));
  };

  useEffect(() => { load(); }, [id]);

  const approve = async (scope: 'verified' | 'all') => {
    if (!id) return;
    setBusy(true);
    await approvalsAPI.decidePlan(id, { decision: 'approved', scope });
    setBusy(false);
    load();
  };

  if (!plan) return <div className="text-muted">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/test-plans" className="text-muted"><ChevronLeft size={20} /></Link>
          <div>
            <h1 className="text-xl font-bold">{plan.requirement?.title}</h1>
            <p className="text-xs text-muted mt-1">{plan.status} · {plan.applicationUrl || 'No application URL'}</p>
          </div>
        </div>
        {plan.status === 'awaiting_approval' && (
          <div className="flex gap-2">
            <button className="btn-secondary !text-xs" disabled={busy} onClick={() => approve('verified')}>Approve verified</button>
            <button className="btn-primary !text-xs" disabled={busy} onClick={() => approve('all')}>Approve reviewed</button>
          </div>
        )}
      </div>

      {plan.explorationError && (
        <div className="card text-sm text-amber-300">Exploration warning: {plan.explorationError}</div>
      )}

      <div className="card">
        <h3 className="font-semibold text-sm mb-3">Observed evidence</h3>
        <div className="space-y-2 text-sm">
          {(plan.evidence || []).slice(0, 40).map((item: any) => (
            <div key={item.id} className="p-3 rounded-lg" style={{ background: 'var(--color-surface2)' }}>
              <div className="text-xs text-muted">{item.kind}</div>
              <div>{item.summary}</div>
              {item.url && <div className="text-xs text-indigo-400 mt-1 truncate">{item.url}</div>}
            </div>
          ))}
          {!plan.evidence?.length && <p className="text-muted text-sm">Evidence will appear after exploration completes.</p>}
        </div>
      </div>

      <div className="space-y-3">
        {(plan.scenarios || []).map((scenario: any) => (
          <Link key={scenario.id} to={`/dashboard/scenarios/${scenario.id}`} className="card block">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted">{scenario.scenarioKey}</div>
                <div className="font-medium">{scenario.title}</div>
              </div>
              <span className={classBadge(scenario.classification)}>{scenario.classification}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
