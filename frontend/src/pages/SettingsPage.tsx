import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { authAPI } from '../services/api';
import { Key, Copy, RefreshCw, Check, User, CreditCard } from 'lucide-react';

export default function SettingsPage() {
  const user = useAppSelector(s => s.auth.user);
  const [apiKey, setApiKey] = useState(user?.apiKey || '');
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateKey = async () => {
    if (!confirm('Regenerate API key? Your old key will stop working immediately.')) return;
    setRegenerating(true);
    try {
      const { data } = await authAPI.regenerateApiKey();
      setApiKey(data.apiKey);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted text-sm mt-1">Manage your account and API access</p>
      </div>

      {/* Profile */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2"><User size={14} /> Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted block mb-1">First Name</label>
            <div className="input opacity-60 cursor-not-allowed">{user?.firstName}</div>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Last Name</label>
            <div className="input opacity-60 cursor-not-allowed">{user?.lastName}</div>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted block mb-1">Email</label>
            <div className="input opacity-60 cursor-not-allowed">{user?.email}</div>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted block mb-1">Company</label>
            <div className="input opacity-60 cursor-not-allowed">{user?.company || '—'}</div>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2"><Key size={14} /> API Key</h2>
        <p className="text-xs text-muted">
          Use this key to authenticate API requests. Pass it as the <code className="text-indigo-400">X-API-Key</code> header.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 input font-mono text-xs flex items-center"
            style={{ background: 'var(--color-surface2)' }}>
            {apiKey ? `${apiKey.slice(0, 8)}${'•'.repeat(24)}${apiKey.slice(-4)}` : 'No API key'}
          </div>
          <button onClick={copyKey} className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0">
            {copied ? <><Check size={13} className="text-emerald-400" /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
          <button onClick={regenerateKey} disabled={regenerating}
            className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0">
            <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Generating...' : 'Regenerate'}
          </button>
        </div>

        {/* Code example */}
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
          <div className="px-4 py-2 text-xs text-muted border-b flex items-center gap-2"
            style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
            Example — Trigger a Playwright test run
          </div>
          <pre className="p-4 text-xs font-mono overflow-auto" style={{ color: '#a5f3fc' }}>{`curl -X POST https://api.testflow.io/api/runs \\
  -H "X-API-Key: ${apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "your-project-id",
    "branch": "main"
  }'`}</pre>
        </div>
      </div>

      {/* Subscription */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2"><CreditCard size={14} /> Subscription</h2>
        <div className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div>
            <div className="font-semibold capitalize">{user?.subscriptionTier} Plan</div>
            <div className="text-xs text-muted mt-0.5">
              {user?.monthlyRunsUsed || 0} / {user?.monthlyRunsLimit || 50} runs used this month
            </div>
          </div>
          <a href="/pricing" className="btn-primary text-xs">Upgrade Plan</a>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card border-red-500/20 space-y-3">
        <h2 className="font-semibold text-sm text-red-400">Danger Zone</h2>
        <p className="text-xs text-muted">Permanently delete your account and all associated data.</p>
        <button className="text-xs text-red-400 border border-red-500/30 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  );
}
