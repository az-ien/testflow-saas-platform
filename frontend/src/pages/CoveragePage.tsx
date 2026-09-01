import React, { useEffect, useState } from 'react';
import { qeAPI } from '../services/api';

export default function CoveragePage() {
  const [coverage, setCoverage] = useState<any[]>([]);
  useEffect(() => {
    qeAPI.coverage().then(({ data }) => setCoverage(data.coverage || []));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coverage</h1>
        <p className="text-muted text-sm mt-1">Requirement to scenario to generated-test traceability</p>
      </div>
      {coverage.map((item) => (
        <div key={item.id} className="card flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted">{item.key} · {item.project?.name}</div>
            <div className="font-semibold">{item.title}</div>
          </div>
          <div className="text-xs text-muted text-right">
            <div>{item.scenarioCount} scenarios</div>
            <div>{item.verified} verified · {item.generated} generated</div>
          </div>
        </div>
      ))}
      {!coverage.length && <div className="card text-muted">Coverage appears after requirements are planned.</div>}
    </div>
  );
}
