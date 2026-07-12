import type { Store } from '../hooks/useStore';
import { DATES, TODAY, md, weekLabel, stageLabel, goalLabel } from '../data/moveData';
import { t } from '../lib/i18n';
import { ACCENT } from '../lib/ui';
import { PageHeader } from '../components/PageHeader';
import { TaskCard } from '../components/TaskCard';

export function Timeline({ store }: { store: Store }) {
  const { tasks } = store;
  return (
    <>
      <PageHeader eyebrow="TIMELINE" title={t('时间计划', 'Timeline')} subtitle={t('按日期推进，每日一张卡片，减少遗漏', 'Day-by-day plan, one card per day, so nothing slips')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DATES.map((dt) => {
          const list = tasks.filter((t) => t.date === dt);
          const dc = list.filter((t) => t.status === 'done').length;
          const dpct = list.length ? Math.round((dc / list.length) * 100) : 0;
          const isToday = dt === TODAY;
          return (
            <div
              key={dt}
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '20px 22px',
                border: `1px solid ${isToday ? 'oklch(0.7 0.1 165)' : 'oklch(0.92 0.006 85)'}`,
                boxShadow: isToday ? '0 0 0 3px oklch(0.92 0.06 165)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                  <div style={{ fontFamily: "'Space Grotesk'", fontSize: 22, fontWeight: 700, color: 'oklch(0.3 0.012 60)' }}>{md(dt)}</div>
                  <div style={{ fontSize: 11, color: 'oklch(0.58 0.01 60)' }}>{weekLabel(dt)}</div>
                </div>
                <div style={{ width: 1, height: 40, background: 'oklch(0.92 0.006 85)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{stageLabel(dt)}</span>
                    {isToday && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: ACCENT, color: '#fff' }}>{t('今天', 'Today')}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 60)', marginTop: 2 }}>{goalLabel(dt)}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Space Grotesk'", fontSize: 12.5, color: 'oklch(0.55 0.01 60)' }}>{dc} / {list.length}</div>
                  <div style={{ width: 92, height: 6, background: 'oklch(0.93 0.006 85)', borderRadius: 999, marginTop: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${dpct}%`, background: ACCENT, borderRadius: 999 }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))', gap: 10, marginTop: 16 }}>
                {list.map((t) => (
                  <TaskCard key={t.id} task={t} onToggle={() => store.toggleTask(t.id)} showOwner showDate={false} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
