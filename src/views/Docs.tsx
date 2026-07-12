import { useState } from 'react';
import type { Store } from '../hooks/useStore';
import { t } from '../lib/i18n';
import { PageHeader } from '../components/PageHeader';

export function Docs({ store }: { store: Store }) {
  const { docs } = store;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (id: string, text: string) => {
    const done = () => {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
      done();
    }
  };

  return (
    <>
      <PageHeader eyebrow="DOCS" title={t('文件与模板', 'Templates')} subtitle={t('常用话术、模板与清单，一键复制', 'Handy scripts, templates and checklists — copy in one tap')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {docs.map((d) => {
          const copied = copiedId === d.id;
          return (
            <div key={d.id} style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{d.title}</span>
                <span style={{ fontSize: 11, color: 'oklch(0.5 0.06 165)', background: 'oklch(0.95 0.02 165)', padding: '2px 8px', borderRadius: 6 }}>{d.tag}</span>
                <button
                  onClick={() => copy(d.id, d.body)}
                  style={{
                    border: `1px solid ${copied ? 'oklch(0.7 0.12 150)' : 'oklch(0.88 0.008 85)'}`,
                    background: copied ? 'oklch(0.95 0.05 150)' : 'white',
                    color: copied ? 'oklch(0.45 0.13 150)' : 'oklch(0.42 0.012 60)',
                    fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                  }}
                >
                  {copied ? t('已复制', 'Copied') : t('复制', 'Copy')}
                </button>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'oklch(0.4 0.01 60)', background: 'oklch(0.98 0.004 85)', borderRadius: 10, padding: 14, flex: 1 }}>{d.body}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
