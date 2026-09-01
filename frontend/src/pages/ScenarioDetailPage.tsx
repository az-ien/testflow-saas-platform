import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { approvalsAPI, scenariosAPI } from '../services/api';
import { ChevronLeft } from 'lucide-react';

export default function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [scenario, setScenario] = useState<any>(null);

  const load = () => {
    if (!id) return;
    scenariosAPI.get(id).then(({ data }) => setScenario(data));
  };

  useEffect(() => { load(); }, [id]);

  if (!scenario) return <div className="text-muted">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard/scenarios" className="text-muted"><ChevronLeft size={20} /></Link>
        <div>
          <div className="text-xs text-muted">{scenario.scenarioKey}</div>
          <h1 className="text-xl font-bold">{scenario.title}</h1>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold mb-2">Requirement</h3>
          <p className="text-sm">{scenario.requirement?.key} — {scenario.requirement?.title}</p>
          <p className="text-xs text-muted mt-2 whitespace-pre-wrap">{scenario.requirement?.acceptanceCriteria}</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-2">Validation</h3>
          <p className="text-sm">{scenario.classification} ({Math.round((scenario.confidence || 0) * 100)}%)</p>
          <ul className="text-xs text-muted mt-2 space-y-1">
            {(scenario.validation?.reasons || []).map((reason: string, idx: number) => <li key={idx}>{reason}</li>)}
          </ul>
        </div>
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-3">Steps</h3>
        <ol className="space-y-2 text-sm">
          {(scenario.steps || []).map((step: any) => (
            <li key={step.order}>{step.order}. {step.action}{step.target ? ` (${step.target})` : ''}</li>
          ))}
        </ol>
        <p className="text-sm mt-4"><span className="text-muted">Expected:</span> {scenario.expectedResult}</p>
        <p className="text-sm mt-2"><span className="text-muted">Why:</span> {scenario.rationale}</p>
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-3">Evidence</h3>
        {(scenario.evidence || []).map((item: any) => (
          <div key={item.id} className="text-sm mb-2">{item.kind}: {item.summary}</div>
        ))}
        {!scenario.evidence?.length && <p className="text-muted text-sm">Linked plan evidence is shown on the test plan.</p>}
      </div>
      {scenario.status === 'validated' && scenario.classification !== 'UNSUPPORTED' && (
        <button className="btn-primary" onClick={async () => {
          await approvalsAPI.decideScenario(scenario.id, { decision: 'approved' });
          load();
        }}>Approve this scenario</button>
      )}
    </div>
  );
}
