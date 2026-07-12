import type { Store } from '../../hooks/useStore';
import { DATES, md, weekLabel } from '../../data/moveData';
import { useMembers } from '../../hooks/useMembers';
import { ACCENT } from '../../lib/ui';
import { t } from '../../lib/i18n';
import { PageHeader } from '../../components/PageHeader';

export function Overview({ store }: { store: Store }) {
  const { tasks } = store;
  const { members } = useMembers();
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProg = tasks.filter((t) => t.status === 'in_progress').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const p0Remain = tasks.filter((t) => t.priority === 'P0' && t.status !== 'done').length;

  const statCards = [
    { label: t('总任务', 'Total tasks'), value: total, sub: t('全部任务数', 'All tasks'), color: 'oklch(0.3 0.012 60)' },
    { label: t('已完成', 'Done'), value: done, sub: `${pct}% ${t('完成', 'done')}`, color: 'oklch(0.58 0.13 150)' },
    { label: t('进行中', 'In progress'), value: inProg, sub: t('正在处理', 'Being worked on'), color: 'oklch(0.55 0.11 245)' },
    { label: t('P0 未完成', 'P0 remaining'), value: p0Remain, sub: t('高优阻塞项', 'High-priority blockers'), color: 'oklch(0.55 0.17 30)' },
  ];

  const perPerson = members.map((p) => {
    const list = tasks.filter((t) => t.owner === p.id);
    const dn = list.filter((t) => t.status === 'done').length;
    const pc = list.length ? Math.round((dn / list.length) * 100) : 0;
    return { ...p, done: dn, total: list.length, pct: pc };
  });

  const perDay = DATES.map((dt) => {
    const list = tasks.filter((t) => t.date === dt);
    const dn = list.filter((t) => t.status === 'done').length;
    const pc = list.length ? Math.round((dn / list.length) * 100) : 0;
    return { name: `${md(dt)} ${weekLabel(dt)}`, done: dn, total: list.length, pct: pc };
  });

  return (
    <>
      <PageHeader eyebrow="ADMIN · OVERVIEW" title={t('数据总览', 'Overview')} subtitle={t('整体进度、每人完成率、每日完成率', 'Overall progress, completion by person and by day')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
        {statCards.map((c) => (
          <div key={c.label} style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 60)' }}>{c.label}</div>
            <div style={{ fontFamily: "'Space Grotesk'", fontSize: 30, fontWeight: 700, marginTop: 6, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11.5, color: 'oklch(0.6 0.01 60)', marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
        <Panel title={t('每人完成率', 'Completion by person')}>
          {perPerson.map((p) => (
            <BarRow
              key={p.id}
              left={<span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: `oklch(0.6 0.14 ${p.hue})` }} />{p.name}</span>}
              right={`${p.done}/${p.total} · ${p.pct}%`}
              pct={p.pct}
              color={`oklch(0.6 0.13 ${p.hue})`}
            />
          ))}
        </Panel>
        <Panel title={t('每日完成率', 'Completion by day')}>
          {perDay.map((p) => (
            <BarRow key={p.name} left={<span>{p.name}</span>} right={`${p.done}/${p.total} · ${p.pct}%`} pct={p.pct} color={ACCENT} />
          ))}
        </Panel>
      </div>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function BarRow({ left, right, pct, color }: { left: React.ReactNode; right: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        {left}
        <span style={{ fontFamily: "'Space Grotesk'", color: 'oklch(0.55 0.01 60)' }}>{right}</span>
      </div>
      <div style={{ height: 8, background: 'oklch(0.93 0.006 85)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}
