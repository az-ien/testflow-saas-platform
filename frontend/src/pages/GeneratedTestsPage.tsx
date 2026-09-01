import React, { useEffect, useState } from 'react';
import { generatedTestsAPI } from '../services/api';
import WorkspaceDiffPreview from '../components/WorkspaceDiffPreview';

const badgeClass = (value?: string) => {
  if (value === 'compiles' || value === 'passed' || value === 'generated' || value === 'ready' || value === 'pr_opened') return 'badge-passed';
  if (value === 'failed' || value === 'error' || value === 'rejected') return 'badge-failed';
  if (value === 'queued' || value === 'running' || value === 'awaiting_approval') return 'badge-running';
  if (value === 'unavailable' || value === 'none') return 'badge-queued';
  return 'badge-queued';
};

const gitLabel = (status?: string) => {
  if (status === 'awaiting_approval') return 'needs publish approval';
  if (status === 'pr_opened') return 'PR opened';
  if (status === 'unavailable') return 'dashboard only';
  if (status === 'rejected') return 'publish rejected';
  return status || 'no git';
};

const canOpenPr = (status?: string) => status === 'awaiting_approval' || status === 'rejected' || status === 'none';

export default function GeneratedTestsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [diffId, setDiffId] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: 'execute' | 'pr' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => generatedTestsAPI.list().then(({ data }) => setItems(data.generatedTests || []));
  useEffect(() => { load(); }, []);

  const execute = async (id: string) => {
    setBusy({ id, action: 'execute' });
    setError(null);
    try {
      await generatedTestsAPI.execute(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Execute failed');
    } finally {
      setBusy(null);
    }
  };

  const openPr = async (id: string) => {
    setBusy({ id, action: 'pr' });
    setError(null);
    try {
      await generatedTestsAPI.openPr(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Open PR failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generated Tests</h1>
        <p className="text-muted text-sm mt-1">
          Playwright files written from approved scenarios. Execute runs those generated files, not the customer repository.
          Publishing opens a feature-branch pull request after approval. Workspaces stay in the dashboard when no GitHub token is configured.
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
                <span className={badgeClass(item.gitStatus)}>{gitLabel(item.gitStatus)}</span>
                {item.pullRequestUrl ? (
                  <a className="text-indigo-400" href={item.pullRequestUrl} target="_blank" rel="noreferrer">{item.pullRequestUrl}</a>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary !text-xs" onClick={() => setOpenId(openId === item.id ? null : item.id)}>View files</button>
              <button className="btn-secondary !text-xs" onClick={() => setDiffId(diffId === item.id ? null : item.id)}>View diff</button>
              <button
                className="btn-secondary !text-xs"
                disabled={Boolean(busy) || item.gitStatus === 'unavailable' || item.gitStatus === 'pr_opened' || !canOpenPr(item.gitStatus)}
                onClick={() => openPr(item.id)}
              >
                {item.gitStatus === 'pr_opened' ? 'PR opened' : busy?.id === item.id && busy.action === 'pr' ? 'Opening…' : 'Open PR'}
              </button>
              <button
                className="btn-primary !text-xs"
                disabled={Boolean(busy)}
                onClick={() => execute(item.id)}
              >
                {busy?.id === item.id && busy.action === 'execute' ? 'Queuing…' : 'Execute'}
              </button>
            </div>
          </div>
          {diffId === item.id && <WorkspaceDiffPreview diffs={item.workspaceDiff} />}
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
