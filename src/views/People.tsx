import type { Store } from '../hooks/useStore';
import { TODAY, md, weekLabel } from '../data/moveData';
import { useMembers } from '../hooks/useMembers';
import { t } from '../lib/i18n';
import { PageHeader } from '../components/PageHeader';
import { TaskCard } from '../components/TaskCard';

export function People({ store }: { store: Store }) {
  const { tasks, person } = store;
  const { members, getMember } = useMembers();
  const selP = getMember(person);

  const mine = tasks.filter((t) => t.owner === person);
  const myDone = mine.filter((t) => t.status === 'done');
  const myUndone = mine.filter((t) => t.status !== 'done');
  const myToday = mine.filter((t) => t.date === TODAY);
  const myUrgent = mine.filter((t) => t.priority === 'P0' && t.status !== 'done').length;
  const myPct = mine.length ? Math.round((myDone.length / mine.length) * 100) : 0;

  return (
    <>
      <PageHeader eyebrow="PEOPLE" title={t('家庭分工', 'My Tasks')} subtitle={t('每个人只看自己的任务', 'Each person sees only their own tasks')} />

      {/* person tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {members.map((p) => {
          const act = person === p.id;
          return (
            <button
              key={p.id}
              onClick={() => store.setPerson(p.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 15px',
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
                border: `1px solid ${act ? `oklch(0.5 0.1 ${p.hue})` : 'oklch(0.9 0.006 85)'}`,
                background: act ? `oklch(0.96 0.03 ${p.hue})` : 'white',
                color: act ? `oklch(0.4 0.14 ${p.hue})` : 'oklch(0.42 0.012 60)',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', marginRight: 7, display: 'inline-block', background: `oklch(0.6 0.14 ${p.hue})` }} />
              {p.name}
            </button>
          );
        })}
      </div>

      {/* selected person summary */}
      <div style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: '18px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, color: '#fff', background: `oklch(0.58 0.13 ${selP.hue})` }}>{selP.name.charAt(0)}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{selP.name}</div>
          <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.01 60)' }}>{selP.role}</div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Stat value={mine.length} label={t('总任务', 'Total')} />
          <Stat value={myDone.length} label={t('已完成', 'Done')} color="oklch(0.58 0.13 150)" />
          <Stat value={myUrgent} label={t('P0 待办', 'P0 to-do')} color="oklch(0.58 0.16 30)" />
          <div style={{ minWidth: 130 }}>
            <div style={{ fontFamily: "'Space Grotesk'", fontSize: 12.5, color: 'oklch(0.55 0.01 60)', marginBottom: 6 }}>{myPct}% {t('完成', 'done')}</div>
            <div style={{ height: 7, background: 'oklch(0.93 0.006 85)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${myPct}%`, background: `oklch(0.6 0.13 ${selP.hue})`, borderRadius: 999 }} />
            </div>
          </div>
        </div>
      </div>

      {myToday.length > 0 && (
        <Group label={`${t('今日任务', 'Today')} · ${md(TODAY)} ${weekLabel(TODAY)}`}>
          {myToday.map((tk) => <TaskCard key={tk.id} task={tk} onToggle={() => store.toggleTask(tk.id)} />)}
        </Group>
      )}

      <Group label={`${t('未完成', 'To do')} · ${myUndone.length}`}>
        {myUndone.map((tk) => <TaskCard key={tk.id} task={tk} onToggle={() => store.toggleTask(tk.id)} />)}
        {!myUndone.length && <Empty text={t('全部完成，太棒了 🎉', 'All done, great job 🎉')} />}
      </Group>

      {myDone.length > 0 && (
        <Group label={`${t('已完成', 'Done')} · ${myDone.length}`}>
          {myDone.map((tk) => <TaskCard key={tk.id} task={tk} onToggle={() => store.toggleTask(tk.id)} showDesc={false} />)}
        </Group>
      )}
    </>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'oklch(0.58 0.01 60)' }}>{label}</div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.4 0.012 60)', margin: '6px 0 10px' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))', gap: 12 }}>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: 'oklch(0.55 0.01 60)', padding: '8px 2px' }}>{text}</div>;
}
