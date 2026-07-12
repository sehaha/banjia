import type { Store } from '../../hooks/useStore';
import { t } from '../../lib/i18n';
import { PageHeader } from '../../components/PageHeader';

export function AdminDocs({ store }: { store: Store }) {
  const { docs } = store;
  return (
    <>
      <PageHeader eyebrow="ADMIN · DOCS" title={t('模板管理', 'Templates')} subtitle={t('编辑话术与模板，家庭端实时同步', 'Edit scripts and templates — synced to the family view in real time')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {docs.map((d) => (
          <div key={d.id} style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14.5, flex: 1 }}>{d.title}</span>
              <span style={{ fontSize: 11, color: 'oklch(0.5 0.06 165)', background: 'oklch(0.95 0.02 165)', padding: '2px 8px', borderRadius: 6 }}>{d.tag}</span>
            </div>
            <textarea
              value={d.body}
              onChange={(e) => store.updateDoc(d.id, e.target.value)}
              style={{ width: '100%', minHeight: 104, resize: 'vertical', padding: 12, border: '1px solid oklch(0.9 0.006 85)', borderRadius: 10, fontSize: 13, lineHeight: 1.6, background: 'oklch(0.98 0.004 85)' }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
