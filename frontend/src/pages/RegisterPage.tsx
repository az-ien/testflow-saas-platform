import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import { register, clearError } from '../features/auth/authSlice';
import { Zap } from 'lucide-react';

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector(s => s.auth);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', company: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(register(form));
    if (register.fulfilled.match(result)) navigate('/dashboard');
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(clearError());
    setForm(f => ({ ...f, [k]: e.target.value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, var(--color-bg) 60%)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-2xl font-bold gradient-text">TestFlow</span>
        </div>

        <div className="card">
          <h1 className="text-xl font-bold mb-1">Create your account</h1>
          <p className="text-muted text-sm mb-6">Start with 50 free runs per month. No credit card required.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-400 border border-red-500/20"
              style={{ background: 'rgba(239,68,68,0.08)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">First Name *</label>
                <input className="input" required placeholder="John" value={form.firstName} onChange={set('firstName')} />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Last Name *</label>
                <input className="input" required placeholder="Doe" value={form.lastName} onChange={set('lastName')} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Email *</label>
              <input type="email" className="input" required placeholder="you@company.com" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Password * (min 8 chars)</label>
              <input type="password" className="input" required minLength={8} placeholder="••••••••" value={form.password} onChange={set('password')} />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Company (optional)</label>
              <input className="input" placeholder="Acme Inc." value={form.company} onChange={set('company')} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm">
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
