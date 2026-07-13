import { lazy, Suspense } from 'react';
import { decodeConfig } from './toy/toyData';

// Route by URL so the family app and the share-by-link "toy" plan coexist without
// conflict: the family app uses the hash (#room=CODE); the toy uses the query
// (?d=…) and the /config builder path. Each is lazy-loaded so a friend opening a
// plan link doesn't download the whole family app (and vice versa).
const FamilyApp = lazy(() => import('./App'));
const PlanView = lazy(() => import('./toy/PlanView'));
const PlanLoader = lazy(() => import('./toy/PlanLoader'));
const ConfigView = lazy(() => import('./toy/ConfigView'));

export default function Root() {
  const path = typeof location !== 'undefined' ? location.pathname.replace(/\/+$/, '') : '';
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const p = params.get('p'); // short-code link
  const d = params.get('d'); // self-contained fallback link

  let node: React.ReactNode;
  if (path === '/config') {
    node = <ConfigView />;
  } else if (p) {
    node = <PlanLoader code={p} />;
  } else if (d) {
    const cfg = decodeConfig(d);
    node = cfg ? <PlanView config={cfg} d={d} /> : <FamilyApp />; // bad link → fall back to the app
  } else {
    node = <FamilyApp />;
  }

  return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'oklch(0.985 0.006 85)' }} />}>{node}</Suspense>;
}
