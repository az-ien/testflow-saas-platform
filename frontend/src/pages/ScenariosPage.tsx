import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { scenariosAPI } from '../services/api';

const classBadge = (value?: string) => {
  if (value === 'VERIFIED') return 'badge-verified';
  if (value === 'UNSUPPORTED') return 'badge-unsupported';
  return 'badge-review';
};

export default function ScenariosPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    scenariosAPI.list().then(({ data }) => setItems(data.scenarios || []));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scenarios</h1>
        <p className="text-muted text-sm mt-1">Evidence-backed test scenarios with hallucination classification</p>
      </div>
      <div className="grid gap-4">
        {items.map((item) => (
          <Link key={item.id} to={`/dashboard/scenarios/${item.id}`} className="card block">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted">{item.scenarioKey} · {item.requirement?.key}</div>
                <div className="font-semibold">{item.title}</div>
                <div className="text-xs text-muted mt-1">{item.project?.name}</div>
              </div>
              <span className={classBadge(item.classification)}>{item.classification}</span>
            </div>
          </Link>
        ))}
        {!items.length && <div className="card text-muted">No scenarios yet.</div>}
      </div>
    </div>
  );
}
