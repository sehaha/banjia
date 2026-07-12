import type { Store } from '../../hooks/useStore';
import type { UtilityStatus } from '../../types';
import { UTIL_STATUS_OPTIONS } from '../../lib/ui';
import { t } from '../../lib/i18n';
import { PageHeader } from '../../components/PageHeader';

export function AdminUtils({ store }: { store: Store }) {
  const { utils } = store;
  return (
    <>
      <PageHeader eyebrow="ADMIN · UTILITIES" title={t('服务管理', 'Utilities')} subtitle={t('维护新旧房服务状态与备注（账号 / 确认号 / 收据号）', 'Maintain service statuses and notes (account / confirmation # / receipt #)')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {utils.map((u) => (
          <div key={u.id} style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 11, padding: '11px 14px', display: 'flex', gap: 11, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: u.type === 'new' ? 'oklch(0.95 0.03 165)' : 'oklch(0.94 0.005 60)',
                color: u.type === 'new' ? 'oklch(0.45 0.1 165)' : 'oklch(0.5 0.01 60)',
              }}
            >
              {u.type === 'new' ? t('新房', 'New') : t('旧房', 'Old')}
            </span>
            <span style={{ fontWeight: 600, fontSize: 14, minWidth: 120 }}>{u.name}</span>
            <select
              value={u.status}
              onChange={(e) => store.setUtilField(u.id, 'status', e.target.value as UtilityStatus)}
              style={{ padding: '6px 9px', border: '1px solid oklch(0.88 0.008 85)', borderRadius: 7, fontSize: 12.5, background: 'white', cursor: 'pointer' }}
            >
              {UTIL_STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <input
              value={u.note}
              onChange={(e) => store.setUtilField(u.id, 'note', e.target.value)}
              placeholder={t('备注 / 确认号 / 收据号…', 'Notes / confirmation # / receipt #…')}
              style={{ flex: 1, minWidth: 200, padding: '7px 10px', border: '1px solid oklch(0.9 0.006 85)', borderRadius: 7, fontSize: 12.5, background: 'oklch(0.98 0.004 85)' }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
