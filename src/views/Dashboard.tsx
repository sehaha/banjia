import { useState } from 'react';
import type { Store } from '../hooks/useStore';
import type { FrontPage } from '../App';
import type { Person } from '../types';
import { TODAY, MOVE_DAY, DATES, md, weekLabel, stageLabel } from '../data/moveData';
import { useMembers } from '../hooks/useMembers';
import { ownerBadge, ACCENT } from '../lib/ui';
import { t } from '../lib/i18n';
import { pushBrief } from '../lib/lark';
import { CheckBox } from '../components/TaskCard';

function daysUntilMove(): number {
  const idx = DATES.indexOf(TODAY);
  const moveIdx = DATES.indexOf(MOVE_DAY);
  return Math.max(0, moveIdx - idx);
}

export function Dashboard({ store, go }: { store: Store; go: (p: FrontPage, opts?: { cat?: string }) => void }) {
  const { tasks } = store;
  const { members, getMember } = useMembers();
  const [larkState, setLarkState] = useState<'idle' | 'pushing' | 'done' | 'unconfigured' | 'error'>('idle');
  const pushToLark = async () => {
    setLarkState('pushing');
    const r = await pushBrief(store.getShared(), TODAY);
    setLarkState(r.configured === false ? 'unconfigured' : r.ok ? 'done' : 'error');
    setTimeout(() => setLarkState('idle'), 4000);
  };
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProg = tasks.filter((t) => t.status === 'in_progress').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const p0Remain = tasks.filter((t) => t.priority === 'P0' && t.status !== 'done').length;

  const todayTasks = tasks.filter((t) => t.date === TODAY);
  const todayGroups = members.map((p) => {
    const list = todayTasks.filter((t) => t.owner === p.id);
    if (!list.length) return null;
    return { person: p, doneCount: list.filter((t) => t.status === 'done').length, total: list.length, tasks: list };
  }).filter(Boolean) as { person: Person; doneCount: number; total: number; tasks: typeof tasks }[];

  const urgentList = tasks.filter((t) => t.priority === 'P0' && t.status !== 'done').slice(0, 6);
  const overdue = tasks.filter((t) => t.date < TODAY && t.status !== 'done');

  const quickLinks: { label: string; onClick: () => void }[] = [
    { label: t('查看时间表', 'Timeline'), onClick: () => go('timeline') },
    { label: t('我的任务', 'My tasks'), onClick: () => go('people') },
    { label: t('服务开通', 'Utilities'), onClick: () => go('utilities') },
    { label: t('退房清单', 'Move-out list'), onClick: () => go('checklist', { cat: '旧房退房' }) },
    { label: t('邻居感谢卡', 'Thank-you cards'), onClick: () => go('docs') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Hero */}
      <div style={{ background: '#26332C', borderRadius: 18, padding: '26px 30px', color: 'white' }}>
        <div style={{ fontFamily: "'Space Grotesk'", fontSize: 11, letterSpacing: '.16em', opacity: 0.55 }}>
          {t('MOVE GUIDE · 家庭搬家执行指南', 'MOVE GUIDE · FAMILY MOVING PLAYBOOK')}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.01em' }}>17 Dava</div>
          <div style={{ fontSize: 22, opacity: 0.45 }}>→</div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.01em' }}>25 New Dawn</div>
          <div style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.6 }}>Irvine, CA</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(128px,1fr))', gap: 1, background: 'rgba(255,255,255,.13)', borderRadius: 12, overflow: 'hidden', marginTop: 22 }}>
          <HeroStat label={t('当前阶段', 'Current stage')} value={stageLabel(TODAY)} />
          <HeroStat label={t('距离搬家', 'Until move')} value={<span style={{ fontFamily: "'Space Grotesk'", fontSize: 19, fontWeight: 600 }}>{daysUntilMove()} <span style={{ fontSize: 12, opacity: 0.7 }}>{t('天', 'd')}</span></span>} />
          <HeroStat label={t('P0 待办', 'P0 to-do')} value={<span style={{ fontFamily: "'Space Grotesk'", fontSize: 19, fontWeight: 600, color: 'oklch(0.78 0.13 40)' }}>{p0Remain}</span>} />
          <HeroStat label={t('进行中', 'In progress')} value={<span style={{ fontFamily: "'Space Grotesk'", fontSize: 19, fontWeight: 600 }}>{inProg}</span>} />
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.75, marginBottom: 7 }}>
            <span>{t('总完成度', 'Overall progress')}</span>
            <span style={{ fontFamily: "'Space Grotesk'" }}>{done} / {total} · {pct}%</span>
          </div>
          <div style={{ height: 9, background: 'rgba(255,255,255,.14)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'oklch(0.72 0.13 150)', borderRadius: 999, transition: 'width .4s' }} />
          </div>
        </div>
      </div>

      {/* Push to Lark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={pushToLark}
          disabled={larkState === 'pushing'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: `1px solid ${ACCENT}`, background: 'white', color: ACCENT, fontSize: 13.5, fontWeight: 600, cursor: larkState === 'pushing' ? 'wait' : 'pointer' }}
        >
          🔔 {t('推送今日简报到飞书群', 'Push today’s brief to Lark')}
        </button>
        {larkState === 'done' && <span style={{ fontSize: 12.5, color: 'oklch(0.5 0.13 150)' }}>{t('已推送 ✓', 'Sent ✓')}</span>}
        {larkState === 'pushing' && <span style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 60)' }}>{t('推送中…', 'Sending…')}</span>}
        {larkState === 'error' && <span style={{ fontSize: 12.5, color: 'oklch(0.55 0.14 30)' }}>{t('推送失败，稍后再试', 'Failed, try again later')}</span>}
        {larkState === 'unconfigured' && <span style={{ fontSize: 12.5, color: 'oklch(0.55 0.1 60)' }}>{t('飞书推送未配置（需先接入群机器人）', 'Lark push not configured (connect the group bot first)')}</span>}
      </div>

      {/* Today tasks grouped by person */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{t('今日任务', 'Today’s tasks')}</span>
          <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12, color: 'oklch(0.55 0.01 60)' }}>{md(TODAY)} {weekLabel(TODAY)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))', gap: 14, marginTop: 14 }}>
          {todayGroups.map((g) => (
            <div key={g.person.id} style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: `oklch(0.6 0.14 ${g.person.hue})` }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>{g.person.name}</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'Space Grotesk'", fontSize: 12, color: 'oklch(0.58 0.01 60)' }}>{g.doneCount}/{g.total}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {g.tasks.map((t) => {
                  const done = t.status === 'done';
                  return (
                    <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <CheckBox checked={done} onClick={() => store.toggleTask(t.id)} size={20} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.4, textDecoration: done ? 'line-through' : undefined, color: done ? 'oklch(0.68 0.01 60)' : 'oklch(0.26 0.012 60)' }}>{t.title}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue reminder */}
      {overdue.length > 0 && (
        <div style={{ background: 'oklch(0.96 0.04 28)', border: '1px solid oklch(0.82 0.1 28)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.55 0.19 28)' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'oklch(0.45 0.18 28)' }}>⚠️ {t(`已逾期 ${overdue.length} 项`, `${overdue.length} overdue`)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {overdue.slice(0, 6).map((t) => {
              const done = t.status === 'done';
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 13.5 }}>
                  <CheckBox checked={done} onClick={() => store.toggleTask(t.id)} size={20} />
                  <span style={{ flex: 1, minWidth: 0, color: 'oklch(0.4 0.05 28)' }}>{t.title}</span>
                  <span style={ownerBadge(getMember(t.owner).hue)}>{getMember(t.owner).name}</span>
                  <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12, color: 'oklch(0.5 0.12 28)' }}>{md(t.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Urgent reminders */}
      <div style={{ background: 'oklch(0.975 0.028 40)', border: '1px solid oklch(0.87 0.07 38)', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.58 0.17 30)' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: 'oklch(0.46 0.16 32)' }}>{t(`紧急提醒 · P0 未完成 ${p0Remain} 项`, `Urgent · ${p0Remain} P0 remaining`)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 13 }}>
          {urgentList.map((t) => {
            const done = t.status === 'done';
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 13.5 }}>
                <CheckBox checked={done} onClick={() => store.toggleTask(t.id)} size={20} />
                <span style={{ flex: 1, minWidth: 0, textDecoration: done ? 'line-through' : undefined, color: done ? 'oklch(0.68 0.06 40)' : 'oklch(0.35 0.05 40)' }}>{t.title}</span>
                <span style={ownerBadge(getMember(t.owner).hue)}>{getMember(t.owner).name}</span>
                <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12, color: 'oklch(0.55 0.06 40)' }}>{md(t.date)}</span>
              </div>
            );
          })}
          {!urgentList.length && <div style={{ fontSize: 13, color: 'oklch(0.5 0.03 40)' }}>🎉 {t('P0 紧急任务已全部完成', 'All P0 urgent tasks are done')}</div>}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <div style={{ fontSize: 12, letterSpacing: '.05em', color: 'oklch(0.58 0.01 60)', fontWeight: 500, marginBottom: 10 }}>{t('快捷入口', 'Quick links')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {quickLinks.map((q) => (
            <button key={q.label} onClick={q.onClick} style={{ padding: '11px 16px', borderRadius: 11, border: '1px solid oklch(0.9 0.006 85)', background: 'white', fontSize: 13.5, cursor: 'pointer', fontWeight: 500, color: 'oklch(0.32 0.012 60)' }}>
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: '#26332C', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
