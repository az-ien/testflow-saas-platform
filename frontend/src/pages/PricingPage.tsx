import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Zap } from 'lucide-react';

const PLANS = [
  {
    id: 'free', name: 'Free', price: 0, runs: 50, parallel: 1,
    features: ['50 runs/month', '1 parallel runner', 'All frameworks', 'Basic dashboard', 'API access'],
    cta: 'Get Started Free', highlight: false,
  },
  {
    id: 'starter', name: 'Starter', price: 29, runs: 500, parallel: 2,
    features: ['500 runs/month', '2 parallel runners', 'All frameworks', 'Full dashboard', 'API access', 'Webhook notifications', 'Email support'],
    cta: 'Start Starter', highlight: false,
  },
  {
    id: 'pro', name: 'Pro', price: 99, runs: 5000, parallel: 5,
    features: ['5,000 runs/month', '5 parallel runners', 'All frameworks', 'Advanced analytics', 'API access', 'Webhook notifications', 'GitHub/GitLab triggers', 'Priority support'],
    cta: 'Start Pro', highlight: true,
  },
  {
    id: 'business', name: 'Business', price: 299, runs: 25000, parallel: 20,
    features: ['25,000 runs/month', '20 parallel runners', 'All frameworks', 'Advanced analytics', 'API access', 'Webhook notifications', 'GitHub/GitLab triggers', 'SSO', 'Dedicated Slack support'],
    cta: 'Start Business', highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen py-20 px-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.1) 0%, var(--color-bg) 60%)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <Link to="/" className="flex items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-bold gradient-text">TestFlow</span>
          </Link>
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-muted text-lg">Run your tests in any language, from any repo. Pay only for what you use.</p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map(plan => (
            <div key={plan.id}
              className={`card flex flex-col relative ${plan.highlight ? 'glow' : ''}`}
              style={plan.highlight ? { border: '1px solid rgba(99,102,241,0.5)' } : {}}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  Most Popular
                </div>
              )}
              <div className="mb-5">
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  {plan.price > 0 && <span className="text-muted text-sm mb-1">/month</span>}
                </div>
                <p className="text-xs text-muted mt-1">{plan.runs.toLocaleString()} runs · {plan.parallel} runner{plan.parallel > 1 ? 's' : ''}</p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs">
                    <Check size={13} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-muted">{f}</span>
                  </li>
                ))}
              </ul>

              <Link to={plan.price === 0 ? '/register' : `/dashboard/settings`}
                className={plan.highlight ? 'btn-primary text-center text-sm' : 'btn-secondary text-center text-sm'}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Enterprise */}
        <div className="mt-8 card text-center"
          style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <h3 className="font-bold text-lg mb-2">Enterprise</h3>
          <p className="text-muted text-sm mb-4">Unlimited runs, 50+ parallel runners, SLA, dedicated infrastructure, and custom pricing.</p>
          <a href="mailto:sales@testflow.io" className="btn-primary inline-flex items-center gap-2 text-sm">
            Contact Sales
          </a>
        </div>
      </div>
    </div>
  );
}
