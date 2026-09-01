import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchProjects } from '../features/projects/projectsSlice';
import { requirementsAPI, testPlansAPI } from '../services/api';
import { Plus, ClipboardList } from 'lucide-react';

export default function RequirementsPage() {
  const dispatch = useAppDispatch();
  const { items: projects } = useAppSelector(s => s.projects);
  const [items, setItems] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ projectId: '', title: '', description: '', acceptanceCriteria: '', source: 'user_story' });
  const [planning, setPlanning] = useState<string | null>(null);

  const load = async () => {
    const { data } = await requirementsAPI.list();
    setItems(data.requirements || []);
  };

  useEffect(() => {
    dispatch(fetchProjects());
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await requirementsAPI.create(form);
    setShowModal(false);
    setForm({ projectId: '', title: '', description: '', acceptanceCriteria: '', source: 'user_story' });
    await load();
  };

  const startPlan = async (requirementId: string) => {
    setPlanning(requirementId);
    await testPlansAPI.create({ requirementId });
    setPlanning(null);
    window.location.href = '/dashboard/test-plans';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Requirements</h1>
          <p className="text-muted text-sm mt-1">User stories, acceptance criteria, and GitHub issues that drive AI planning</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Requirement
        </button>
      </div>

      {!items.length && (
        <div className="card text-center py-16">
          <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="font-semibold mb-2">No requirements yet</h3>
          <p className="text-muted text-sm">Add a user story or acceptance criteria to start the AI QE workflow.</p>
        </div>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="card flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-muted">{item.key} · {item.source?.replace('_', ' ')}</div>
              <div className="font-semibold mt-1">{item.title}</div>
              <p className="text-sm text-muted mt-2 whitespace-pre-wrap line-clamp-3">{item.acceptanceCriteria || item.description}</p>
              <div className="text-xs text-muted mt-2">{item.project?.name}</div>
            </div>
            <button className="btn-primary !text-xs" disabled={planning === item.id} onClick={() => startPlan(item.id)}>
              {planning === item.id ? 'Queuing...' : 'Plan with AI'}
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <form onSubmit={handleCreate} className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h2 className="text-lg font-bold">New requirement</h2>
            <select className="input" required value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
              <option value="">Select project</option>
              {projects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <input className="input" required placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className="input min-h-[90px]" placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <textarea className="input min-h-[120px]" placeholder="Acceptance criteria, one per line" value={form.acceptanceCriteria} onChange={e => setForm(f => ({ ...f, acceptanceCriteria: e.target.value }))} />
            <div className="flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary flex-1">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
