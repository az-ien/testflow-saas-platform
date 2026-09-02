import React, { useEffect, useState } from 'react';
import { organizationsAPI } from '../services/api';

export default function OrganizationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [invite, setInvite] = useState({ organizationId: '', email: '', role: 'member' });

  const load = () => organizationsAPI.me().then(({ data }) => setItems(data.organizations || []));
  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-muted text-sm mt-1">Invite teammates to a workspace. Project owners still keep user-level isolation.</p>
      </div>
      <form
        className="card flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          await organizationsAPI.create({ name });
          setName('');
          await load();
        }}
      >
        <input className="input flex-1" placeholder="New organization name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary !text-xs">Create</button>
      </form>
      {items.map((row) => (
        <div key={row.id} className="card space-y-2">
          <div className="font-semibold">{row.organization?.name || 'Organization'}</div>
          <div className="text-xs text-muted">Role: {row.role}</div>
        </div>
      ))}
      <form
        className="card space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await organizationsAPI.invite(invite.organizationId, { email: invite.email, role: invite.role });
          await load();
        }}
      >
        <div className="font-semibold">Invite member</div>
        <select className="input" required value={invite.organizationId} onChange={(e) => setInvite((f) => ({ ...f, organizationId: e.target.value }))}>
          <option value="">Select organization</option>
          {items.map((row) => (
            <option key={row.organizationId} value={row.organizationId}>{row.organization?.name}</option>
          ))}
        </select>
        <input className="input" type="email" required placeholder="Teammate email" value={invite.email} onChange={(e) => setInvite((f) => ({ ...f, email: e.target.value }))} />
        <button className="btn-primary !text-xs">Invite</button>
      </form>
    </div>
  );
}
