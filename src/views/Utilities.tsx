import type { Store } from '../hooks/useStore';
import type { Utility } from '../types';
import { utilMeta } from '../lib/ui';
import { t } from '../lib/i18n';
import { PageHeader } from '../components/PageHeader';

function UtilCard({ u, onCycle }: { u: Utility; onCycle: () => void }) {
  const m = utilMeta(u.status);
  return (
    <div style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{u.name}</div>
        <button
          onClick={onCycle}
          style={{ border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: `oklch(0.95 ${m.c * 0.35} ${m.h})`, color: `oklch(0.44 ${m.c} ${m.h})` }}
        >
          {m.label}
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 60)', marginTop: 4 }}>{u.provider}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12, fontSize: 12.5 }}>
        <div>
          <div style={{ color: 'oklch(0.62 0.01 60)', fontSize: 11, marginBottom: 2 }}>{t('地址', 'Address')}</div>
          <div>{u.address}</div>
        </div>
        <div>
          <div style={{ color: 'oklch(0.62 0.01 60)', fontSize: 11, marginBottom: 2 }}>{u.type === 'new' ? t('开始日期', 'Start date') : t('处理', 'Action')}</div>
          <div style={{ fontFamily: "'Space Grotesk'" }}>{u.start}</div>
        </div>
      </div>
      {u.note && (
        <div style={{ marginTop: 11, fontSize: 12, color: 'oklch(0.5 0.01 60)', background: 'oklch(0.97 0.005 85)', padding: '8px 11px', borderRadius: 8, lineHeight: 1.5 }}>{u.note}</div>
      )}
    </div>
  );
}

export function Utilities({ store }: { store: Store }) {
  const { utils } = store;
  const newUtils = utils.filter((u) => u.type === 'new');
  const oldUtils = utils.filter((u) => u.type === 'old');

  return (
    <>
      <PageHeader eyebrow="UTILITIES" title={t('服务开通', 'Utilities')} subtitle={t('集中管理新旧房服务，点击状态可切换 · 避免开错、关早、漏退设备', 'Manage both homes’ services — tap a status to change it · avoid wrong setups, early shut-offs, unreturned gear')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(288px,1fr))', gap: 20 }}>
        <div>
          <ColHeader dot="oklch(0.55 0.1 165)" title={t('新房服务 · 25 New Dawn', 'New home · 25 New Dawn')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {newUtils.map((u) => <UtilCard key={u.id} u={u} onCycle={() => store.cycleUtil(u.id)} />)}
          </div>
        </div>
        <div>
          <ColHeader dot="oklch(0.6 0.02 60)" title={t('旧房服务 · 17 Dava', 'Old home · 17 Dava')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {oldUtils.map((u) => <UtilCard key={u.id} u={u} onCycle={() => store.cycleUtil(u.id)} />)}
          </div>
        </div>
      </div>
    </>
  );
}

function ColHeader({ dot, title }: { dot: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot }} />
      <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
    </div>
  );
}
