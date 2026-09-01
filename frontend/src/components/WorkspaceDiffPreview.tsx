import React from 'react';

export default function WorkspaceDiffPreview({ diffs }: { diffs?: any[] }) {
  if (!diffs?.length) {
    return <div className="text-xs text-muted">No workspace diff stored.</div>;
  }
  return (
    <div className="space-y-3">
      {diffs.map((diff) => (
        <div key={diff.path}>
          <div className="text-xs text-muted mb-1">
            {diff.path} · {diff.change}
          </div>
          {diff.change === 'unchanged' ? (
            <div className="text-xs text-muted">No line changes versus the connected branch.</div>
          ) : (
            <pre className="text-xs overflow-auto p-3 rounded-lg" style={{ background: 'var(--color-surface2)' }}>
              {diff.patch}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
