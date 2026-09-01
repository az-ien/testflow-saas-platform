import React, { useEffect, useState } from 'react';
import { healingAPI } from '../services/api';

export default function HealingPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    healingAPI.list().then(({ data }) => setItems(data.healingAttempts || []));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Healing</h1>
        <p className="text-muted text-sm mt-1">Failure analysis, proposed fixes, and re-run history. Fixes are not applied until approved.</p>
      </div>
      {items.map((item) => (
        <div key={item.id} className="card space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{item.category || 'unknown'} · {item.status}</div>
            <div className="text-xs text-muted">{Math.round((item.confidence || 0) * 100)}% confidence</div>
          </div>
          <p className="text-sm">{item.summary}</p>
          <p className="text-sm text-muted">{item.proposedFix}</p>
          {item.pullRequestUrl && <a className="text-xs text-indigo-400" href={item.pullRequestUrl} target="_blank" rel="noreferrer">{item.pullRequestUrl}</a>}
        </div>
      ))}
      {!items.length && <div className="card text-muted">No healing attempts yet. Failed test runs enqueue analysis automatically.</div>}
    </div>
  );
}
