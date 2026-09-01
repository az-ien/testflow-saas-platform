import React, { useEffect, useState } from 'react';
import { generatedTestsAPI } from '../services/api';

export default function GeneratedTestsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => generatedTestsAPI.list().then(({ data }) => setItems(data.generatedTests || []));
  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generated Tests</h1>
        <p className="text-muted text-sm mt-1">Playwright files created from approved scenarios. Pull requests never target production by default.</p>
      </div>
      {items.map((item) => (
        <div key={item.id} className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{item.scenario?.title || 'Generated test'}</div>
              <div className="text-xs text-muted mt-1">
                {item.requirement?.key} · {item.framework} · {item.status}
                {item.pullRequestUrl ? ` · ${item.pullRequestUrl}` : ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary !text-xs" onClick={() => setOpenId(openId === item.id ? null : item.id)}>View files</button>
              <button className="btn-secondary !text-xs" onClick={() => generatedTestsAPI.openPr(item.id).then(load)}>Open PR</button>
              <button className="btn-primary !text-xs" onClick={() => generatedTestsAPI.execute(item.id)}>Execute</button>
            </div>
          </div>
          {openId === item.id && (
            <div className="space-y-3">
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
