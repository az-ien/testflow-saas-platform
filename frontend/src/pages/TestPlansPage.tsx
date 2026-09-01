import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { testPlansAPI } from '../services/api';
import { Brain } from 'lucide-react';

export default function TestPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    testPlansAPI.list().then(({ data }) => setPlans(data.testPlans || []));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Test Plans</h1>
        <p className="text-muted text-sm mt-1">Exploration, scenario generation, and validation status</p>
      </div>
      {!plans.length && (
        <div className="card text-center py-16">
          <Brain size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-muted">No plans yet. Start planning from a requirement.</p>
        </div>
      )}
      <div className="grid gap-4">
        {plans.map((plan) => (
          <Link key={plan.id} to={`/dashboard/test-plans/${plan.id}`} className="card block">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">{plan.requirement?.title || 'Requirement'}</div>
                <div className="text-xs text-muted mt-1">{plan.project?.name} · {plan.summary || 'Queued for exploration'}</div>
              </div>
              <span className="badge-running">{plan.status.replace('_', ' ')}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-center text-xs">
              <div><div className="text-lg font-bold text-emerald-400">{plan.verifiedCount}</div>Verified</div>
              <div><div className="text-lg font-bold text-amber-400">{plan.needsReviewCount}</div>Needs review</div>
              <div><div className="text-lg font-bold text-red-400">{plan.unsupportedCount}</div>Unsupported</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
