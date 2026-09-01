import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalsAPI } from '../services/api';
import WorkspaceDiffPreview from '../components/WorkspaceDiffPreview';

export default function ApprovalsPage() {
  const [data, setData] = useState<any>({ testPlans: [], healingAttempts: [], generatedTests: [] });
  const [error, setError] = useState<string | null>(null);
  const load = () => approvalsAPI.list().then(({ data: payload }) => setData(payload));
  useEffect(() => { load(); }, []);

  const decidePlan = async (id: string, scope: 'verified' | 'all') => {
    await approvalsAPI.decidePlan(id, { decision: 'approved', scope });
    await load();
  };

  const decideHeal = async (id: string, decision: 'approved' | 'rejected') => {
    await approvalsAPI.decideHealing(id, { decision });
    await load();
  };

  const decideGit = async (id: string, decision: 'approved' | 'rejected') => {
    setError(null);
    try {
      await approvalsAPI.decideGeneratedTest(id, { decision });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Git publish decision failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-muted text-sm mt-1">
          Human QA gate for verified scenarios, healing fixes, and feature-branch git publish
        </p>
      </div>
      {error && <div className="card text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>}

      <div className="space-y-4">
        <h2 className="font-semibold">AI test plans</h2>
        {data.testPlans?.map((plan: any) => (
          <div key={plan.id} className="card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Link to={`/dashboard/test-plans/${plan.id}`} className="font-semibold hover:text-indigo-400">{plan.requirement?.title}</Link>
                <div className="text-xs text-muted mt-1">
                  {plan.verifiedCount} verified · {plan.needsReviewCount} need review · {plan.unsupportedCount} unsupported
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary !text-xs" onClick={() => decidePlan(plan.id, 'verified')}>Approve verified</button>
                <button className="btn-primary !text-xs" onClick={() => decidePlan(plan.id, 'all')}>Approve reviewed</button>
              </div>
            </div>
          </div>
        ))}
        {!data.testPlans?.length && <div className="card text-muted">No plans waiting for approval.</div>}
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold">Generated workspace publish</h2>
        {data.generatedTests?.map((item: any) => (
          <div key={item.id} className="card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{item.scenario?.title || 'Generated workspace'}</div>
                <div className="text-xs text-muted mt-1">
                  {item.requirement?.key} · {item.project?.name} · {item.workspaceDiff?.length || 0} file{(item.workspaceDiff?.length || 0) === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary !text-xs" onClick={() => decideGit(item.id, 'approved')}>Approve publish</button>
                <button className="btn-secondary !text-xs" onClick={() => decideGit(item.id, 'rejected')}>Reject</button>
              </div>
            </div>
            <WorkspaceDiffPreview diffs={item.workspaceDiff} />
          </div>
        ))}
        {!data.generatedTests?.length && <div className="card text-muted">No generated workspaces waiting to publish.</div>}
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold">Healing proposals</h2>
        {data.healingAttempts?.map((attempt: any) => (
          <div key={attempt.id} className="card space-y-3">
            <div className="font-medium">{attempt.summary}</div>
            <p className="text-sm text-muted mt-2">{attempt.proposedFix}</p>
            <div className="text-xs text-muted mt-2">
              {attempt.category} · reproduced={String(Boolean(attempt.analysis?.reproduced))}
              · isolation={String(Boolean(attempt.analysis?.isolationVerified))}
            </div>
            <WorkspaceDiffPreview diffs={attempt.proposedDiff} />
            <div className="flex gap-2 mt-4">
              <button className="btn-primary !text-xs" onClick={() => decideHeal(attempt.id, 'approved')}>Approve fix</button>
              <button className="btn-secondary !text-xs" onClick={() => decideHeal(attempt.id, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
        {!data.healingAttempts?.length && <div className="card text-muted">No healing proposals waiting.</div>}
      </div>
    </div>
  );
}
