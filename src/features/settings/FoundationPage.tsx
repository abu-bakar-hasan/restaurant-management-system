import { useEffect, useState } from 'react';
import { Fade } from '@animate-ui/react/primitives/effects/fade';
import { HugeiconsIcon } from '@hugeicons/react';
import { DatabaseIcon, RepeatIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { callDesktop, normalizeError } from '@/lib/tauri/client';
import type { AppError, BootstrapStatus } from '@/types/desktop';

export function FoundationPage() {
  const [status, setStatus] = useState<BootstrapStatus>();
  const [error, setError] = useState<AppError>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    callDesktop('bootstrap_status')
      .then((result) => { if (active) setStatus(result); })
      .catch((cause: unknown) => { if (active) setError(normalizeError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  return <Fade asChild><section className="setup-page">
    <p className="eyebrow">Restaurant billing & management</p>
    <h1>Application foundation</h1>
    <p className="intro">A local Windows workspace for table service and walk-in billing. Operational features are under development.</p>
    <section className="status-panel" aria-labelledby="storage-title" aria-busy={loading}>
      <div className="section-heading"><HugeiconsIcon icon={DatabaseIcon} size={22} aria-hidden="true" /><h2 id="storage-title">Local database</h2></div>
      {loading && <p role="status">Checking desktop connection…</p>}
      {!loading && error && <div role="alert" className="error-panel"><h3>Connection unavailable</h3><p>{error.message}</p><small>Reference: {error.code} · {error.correlationId}</small></div>}
      {!loading && !error && status && <dl className="diagnostics">
        <div><dt>Storage</dt><dd>{status.databaseReady ? 'Initialized and checked' : 'Unavailable'}</dd></div>
        <div><dt>Schema version</dt><dd>{status.schemaVersion}</dd></div>
        <div><dt>Application version</dt><dd>{status.appVersion}</dd></div>
        <div><dt>Restaurant operations</dt><dd>{status.operationalReady ? 'Ready' : 'Not implemented yet'}</dd></div>
      </dl>}
      <Button variant="outline" disabled={loading} onClick={() => setAttempt((value) => value + 1)}><HugeiconsIcon icon={RepeatIcon} size={16} aria-hidden="true" />Check connection</Button>
    </section>
    <section className="next-steps"><h2>Development status</h2><p>Admin setup, menu, tables, orders, checkout, printing, reports and recovery are pending. This build must not be used to record restaurant sales.</p><p>Implementation and verification gates are tracked in PROGRESS.md.</p></section>
  </section></Fade>;
}
