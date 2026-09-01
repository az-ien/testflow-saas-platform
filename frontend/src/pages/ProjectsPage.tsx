import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchProjects, createProject, deleteProject } from '../features/projects/projectsSlice';
import { triggerRun } from '../features/runs/runsSlice';
import { Plus, FolderGit2, Play, Trash2, ExternalLink, GitBranch, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const FRAMEWORKS = ['playwright', 'cypress', 'selenium', 'pytest', 'testng', 'jest', 'mocha'];
const PROVIDERS  = ['github', 'gitlab', 'bitbucket', 'azure_devops'];

const FrameworkBadge = ({ fw }: { fw: string }) => {
  const colors: Record<string, string> = {
    playwright: '#45ba4b', cypress: '#17202c', jest: '#c21325',
    selenium: '#43b02a', pytest: '#3776ab', testng: '#ea7c00', mocha: '#8d6748',
  };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
      style={{ background: colors[fw] || '#6366f1' }}>
      {fw}
    </span>
  );
};

export default function ProjectsPage() {
  const dispatch = useAppDispatch();
  const { items: projects, loading } = useAppSelector(s => s.projects);
  const [showModal, setShowModal] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', repoUrl: '', repoProvider: 'github',
    repoBranch: 'main', framework: 'playwright', testPattern: '',
    webhookUrl: '', repoAccessToken: '', applicationUrl: '',
  });

  useEffect(() => { dispatch(fetchProjects()); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatch(createProject(form));
    setShowModal(false);
    setForm({ name: '', description: '', repoUrl: '', repoProvider: 'github', repoBranch: 'main', framework: 'playwright', testPattern: '', webhookUrl: '', repoAccessToken: '', applicationUrl: '' });
  };

  const handleTrigger = async (projectId: string) => {
    setTriggering(projectId);
    await dispatch(triggerRun({ projectId }));
    setTriggering(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this project and all its runs?')) dispatch(deleteProject(id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted text-sm mt-1">Connect an application URL and repository for AI quality engineering</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Project
        </button>
      </div>

      {loading && <div className="text-center text-muted py-10">Loading...</div>}

      {!loading && projects.length === 0 && (
        <div className="card text-center py-16">
          <FolderGit2 size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="font-semibold mb-2">No projects yet</h3>
          <p className="text-muted text-sm mb-4">Connect your first test repo to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">Create Project</button>
        </div>
      )}

      <div className="grid gap-4">
        {projects.map(project => (
          <div key={project.id} className="card flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--color-surface2)' }}>
                <FolderGit2 size={20} style={{ color: '#6366f1' }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link to={`/dashboard/projects/${project.id}`}
                    className="font-semibold hover:text-indigo-400 transition-colors truncate">
                    {project.name}
                  </Link>
                  <FrameworkBadge fw={project.framework} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-1">
                  <span className="flex items-center gap-1"><GitBranch size={11} />{project.repoBranch}</span>
                  <span>{project.repoProvider}</span>
                  <span>{project.totalRuns || 0} runs</span>
                  {project.lastRunAt && <span>Last run {formatDistanceToNow(new Date(project.lastRunAt), { addSuffix: true })}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href={project.repoUrl} target="_blank" rel="noreferrer"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors btn-secondary !px-0">
                <ExternalLink size={14} />
              </a>
              <button onClick={() => handleTrigger(project.id)}
                disabled={triggering === project.id}
                className="btn-primary flex items-center gap-1.5 !py-1.5 !text-xs">
                <Play size={13} />
                {triggering === project.id ? 'Queuing...' : 'Run Now'}
              </button>
              <button onClick={() => handleDelete(project.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10 hover:text-red-400"
                style={{ background: 'var(--color-surface2)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">New Project</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-muted" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Project Name *</label>
                  <input className="input" required placeholder="My Playwright Tests"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Application URL</label>
                  <input className="input" placeholder="https://www.saucedemo.com"
                    value={form.applicationUrl} onChange={e => setForm(f => ({ ...f, applicationUrl: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Repository URL</label>
                  <input className="input" placeholder="https://github.com/user/repo"
                    value={form.repoUrl} onChange={e => setForm(f => ({ ...f, repoUrl: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Provider</label>
                  <select className="input" value={form.repoProvider}
                    onChange={e => setForm(f => ({ ...f, repoProvider: e.target.value }))}>
                    {PROVIDERS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Framework</label>
                  <select className="input" value={form.framework}
                    onChange={e => setForm(f => ({ ...f, framework: e.target.value }))}>
                    {FRAMEWORKS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Branch</label>
                  <input className="input" placeholder="main"
                    value={form.repoBranch} onChange={e => setForm(f => ({ ...f, repoBranch: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Test Pattern</label>
                  <input className="input" placeholder="**/*.spec.ts"
                    value={form.testPattern} onChange={e => setForm(f => ({ ...f, testPattern: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Access Token (private repos)</label>
                  <input className="input" type="password" placeholder="ghp_xxxxx"
                    value={form.repoAccessToken} onChange={e => setForm(f => ({ ...f, repoAccessToken: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
