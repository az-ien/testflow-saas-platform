import React, { useEffect, useState } from 'react';
import { qeAPI } from '../services/api';

export default function CoveragePage() {
  const [coverage, setCoverage] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  useEffect(() => {
    qeAPI.coverage().then(({ data }) => {
      setCoverage(data.coverage || []);
      setTotals(data.totals || null);
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coverage</h1>
        <p className="text-muted text-sm mt-1">Requirement to scenario to generated-test traceability</p>
      </div>
      {totals && (
        <div className="card text-sm text-muted">
          {totals.requirements} requirements · {totals.scenarios} scenarios · {totals.verified} verified · {totals.generated} generated
        </div>
      )}
      {coverage.map((item) => (
        <div key={item.id} className="card flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted">{item.key} · {item.project?.name}</div>
            <div className="font-semibold">{item.title}</div>
          </div>
          <div className="text-xs text-muted text-right">
            <div>{item.scenarioCount} scenarios</div>
            <div>{item.verified} verified · {item.generated} generated · {item.automationCoverage || 0}% automated</div>
            <div>{item.needsReview || 0} review · {item.unsupported || 0} unsupported</div>
          </div>
        </div>
      ))}
      {!coverage.length && <div className="card text-muted">Coverage appears after requirements are planned.</div>}
    </div>
  );
}
