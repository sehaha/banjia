import { useEffect, useState } from 'react';
import PlanView from './PlanView';
import type { MoveConfig } from './toyData';

// Resolves a short ?p=CODE link: fetch the stored config, then render the plan.
export default function PlanLoader({ code }: { code: string }) {
  const [state, setState] = useState<{ loading: boolean; cfg: MoveConfig | null }>({ loading: true, cfg: null });

  useEffect(() => {
    let alive = true;
    fetch(`/api/plan?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setState({ loading: false, cfg: j?.config ?? null }); })
      .catch(() => { if (alive) setState({ loading: false, cfg: null }); });
    return () => { alive = false; };
  }, [code]);

  if (state.loading) return <Splash text="正在打开… · Opening…" />;
  if (!state.cfg) return <Splash text="这个链接已失效或不存在 · This link is invalid or has expired 🥲" />;
  return <PlanView config={state.cfg} d={code} />;
}

function Splash({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.985 0.006 85)', color: 'oklch(0.5 0.01 60)', fontSize: 14, padding: 20, textAlign: 'center' }}>{text}</div>
  );
}
