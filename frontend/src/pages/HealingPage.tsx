import React, { useEffect, useState } from 'react';
import { healingAPI } from '../services/api';

const badgeClass = (value?: string) => {
  if (value === 'verified' || value === 'approved' || value === 'applied') return 'badge-passed';
  if (value === 'failed' || value === 'rejected') return 'badge-failed';
  return 'badge-queued';
};

export default function HealingPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    healingAPI.list().then(({ data }) => setItems(data.healingAttempts || []));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Healing</h1>
        <p className="text-muted text-sm mt-1">
          Failures are reproduced in a browser. Locator patches are rerun in isolation and are not applied until approved.
          Assertions are never removed to make a test pass.
        </p>
      </div>
      {items.map((item) => (
        <div key={item.id} className="card space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{item.category || 'unknown'} · {item.status}</div>
            <div className="text-xs text-muted">{Math.round((item.confidence || 0) * 100)}% confidence</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={badgeClass(item.analysis?.reproduced ? 'verified' : undefined)}>
              {item.analysis?.reproduced ? 'reproduced' : 'logs only'}
            </span>
            <span className={badgeClass(item.analysis?.isolationVerified ? 'verified' : undefined)}>
              {item.analysis?.isolationVerified ? 'isolation rerun passed' : 'isolation unverified'}
            </span>
          </div>
          <p className="text-sm">{item.summary}</p>
          <p className="text-sm text-muted">{item.proposedFix}</p>
          {item.files?.length ? (
            <div className="text-xs text-muted">{item.files.length} patched file{item.files.length === 1 ? '' : 's'}</div>
          ) : null}
          {item.pullRequestUrl && <a className="text-xs text-indigo-400" href={item.pullRequestUrl} target="_blank" rel="noreferrer">{item.pullRequestUrl}</a>}
        </div>
      ))}
      {!items.length && <div className="card text-muted">No healing attempts yet. Failed generated-test runs enqueue analysis automatically.</div>}
    </div>
  );
}
