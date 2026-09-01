import React, { useEffect, useState } from 'react';
import { generatedTestsAPI } from '../services/api';

const badgeClass = (value?: string) => {
  if (value === 'compiles' || value === 'passed' || value === 'generated' || value === 'ready') return 'badge-passed';
  if (value === 'failed' || value === 'error') return 'badge-failed';
  if (value === 'queued' || value === 'running') return 'badge-running';
  return 'badge-queued';
};

export default function GeneratedTestsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => generatedTestsAPI.list().then(({ data }) => setItems(data.generatedTests || []));
  useEffect(() => { load(); }, []);

  const execute = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await generatedTestsAPI.execute(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Execute failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generated Tests</h1>
        <p className="text-muted text-sm mt-1">
          Playwright files written from approved scenarios. Execute runs those generated files, not the customer repository.
          Pull requests never target production by default.
        </p>
      </div>
      {error && <div className="card text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>}
      {items.map((item) => (
        <div key={item.id} className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{item.scenario?.title || 'Generated test'}</div>
              <div className="text-xs text-muted mt-1 flex flex-wrap gap-2 items-center">
                <span>{item.requirement?.key} · {item.framework}</span>
                <span className={badgeClass('generated')}>generated</span>
                <span className={badgeClass(item.compileStatus)}>{item.compileStatus || 'pending'}</span>
                <span className={badgeClass(item.executionStatus)}>
                  {item.executionStatus === 'passed' || item.executionStatus === 'failed'
                    ? `executed · ${item.executionStatus}`
                    : (item.executionStatus || 'pending')}
                </span>
                {item.pullRequestUrl ? <span>{item.pullRequestUrl}</span> : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary !text-xs" onClick={() => setOpenId(openId === item.id ? null : item.id)}>View files</button>
              <button className="btn-secondary !text-xs" onClick={() => generatedTestsAPI.openPr(item.id).then(load)}>Open PR</button>
              <button
                className="btn-primary !text-xs"
                disabled={busyId === item.id}
                onClick={() => execute(item.id)}
              >
                {busyId === item.id ? 'Queuing…' : 'Execute'}
              </button>
            </div>
          </div>
          {openId === item.id && (
            <div className="space-y-3">
              {item.compileLog && item.compileStatus === 'failed' && (
                <pre className="text-xs overflow-auto p-3 rounded-lg" style={{ background: 'var(--color-surface2)' }}>{item.compileLog}</pre>
              )}
              {(item.files || []).map((file: any) => (
                <div key={file.path}>
                  <div className="text-xs text-muted mb-1">{file.path}</div>
                  <pre className="text-xs overflow-auto p-3 rounded-lg" style={{ background: 'var(--color-surface2)' }}>{file.content}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {!items.length && <div className="card text-muted">No generated tests yet. Approve a verified plan first.</div>}
    </div>
  );
}
