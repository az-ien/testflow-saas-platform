import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalsAPI } from '../services/api';

export default function ApprovalsPage() {
  const [data, setData] = useState<any>({ testPlans: [], healingAttempts: [] });
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-muted text-sm mt-1">Human QA gate for verified scenarios and healing fixes</p>
      </div>

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
        <h2 className="font-semibold">Healing proposals</h2>
        {data.healingAttempts?.map((attempt: any) => (
          <div key={attempt.id} className="card">
            <div className="font-medium">{attempt.summary}</div>
            <p className="text-sm text-muted mt-2">{attempt.proposedFix}</p>
            <div className="text-xs text-muted mt-2">
              {attempt.category} · reproduced={String(Boolean(attempt.analysis?.reproduced))}
              · isolation={String(Boolean(attempt.analysis?.isolationVerified))}
            </div>
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
