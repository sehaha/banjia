import { useState } from 'react';
import type { Store } from '../hooks/useStore';
import type { Task } from '../types';
import { CATEGORIES, TODAY, MOVE_DAY, catLabel } from '../data/moveData';
import { useMembers } from '../hooks/useMembers';
import { ACCENT } from '../lib/ui';
import { t } from '../lib/i18n';
import { PageHeader } from '../components/PageHeader';
import { TaskCard } from '../components/TaskCard';

// [value, zh, en]
const DATE_CHIPS: [string, string, string][] = [
  ['all', '全部', 'All'], ['today', '今天', 'Today'], ['tomorrow', '明天', 'Tomorrow'],
  ['before', '搬家前', 'Before move'], ['moveday', '搬家当天', 'Move day'], ['after', '搬家后', 'After move'],
];

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 999,
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
    border: `1px solid ${active ? ACCENT : 'oklch(0.88 0.008 85)'}`,
    background: active ? ACCENT : 'white',
    color: active ? '#fff' : 'oklch(0.4 0.012 60)',
  };
}

export function Checklist({ store, cat, setCat }: { store: Store; cat: string; setCat: (c: string) => void }) {
  const { tasks } = store;
  const { members } = useMembers();
  const [fOwner, setFOwner] = useState('all');
  const [fDate, setFDate] = useState('all');
  const ownerChips: [string, string][] = [['all', t('全部', 'All')], ...members.map((m) => [m.id, m.name] as [string, string])];

  const dateMatch = (t: Task) => {
    const d = t.date;
    if (fDate === 'all') return true;
    if (fDate === 'today') return d === TODAY;
    if (fDate === 'tomorrow') return d === '07-06';
    if (fDate === 'before') return d < MOVE_DAY;
    if (fDate === 'moveday') return d === MOVE_DAY;
    if (fDate === 'after') return d > MOVE_DAY;
    return true;
  };

  const filtered = tasks.filter(
    (t) => (fOwner === 'all' || t.owner === fOwner) && dateMatch(t) && (cat === 'all' || t.category === cat),
  );
  const shownDone = filtered.filter((t) => t.status === 'done').length;

  const selectStyle: React.CSSProperties = { padding: '7px 11px', border: '1px solid oklch(0.88 0.008 85)', borderRadius: 9, fontSize: 13, background: 'white', cursor: 'pointer' };

  return (
    <>
      <PageHeader eyebrow="CHECKLIST" title={t('任务清单', 'Checklist')} subtitle={t('全部任务集中管理，可按人、时间、分类筛选', 'All tasks in one place — filter by person, time, or category')} />

      <div style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: '16px 18px', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FilterRow label={t('负责人', 'Owner')}>
          {ownerChips.map(([v, l]) => <button key={v} onClick={() => setFOwner(v)} style={chipStyle(fOwner === v)}>{l}</button>)}
        </FilterRow>
        <FilterRow label={t('时间', 'Time')}>
          {DATE_CHIPS.map(([v, zh, en]) => <button key={v} onClick={() => setFDate(v)} style={chipStyle(fDate === v)}>{t(zh, en)}</button>)}
        </FilterRow>
        <FilterRow label={t('分类', 'Category')}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={selectStyle}>
            <option value="all">{t('全部分类', 'All categories')}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
        </FilterRow>
      </div>

      <div style={{ fontSize: 13, color: 'oklch(0.5 0.01 60)', marginBottom: 12, fontFamily: "'Space Grotesk'" }}>
        {t(`共 ${filtered.length} 项 · 已完成 ${shownDone}`, `${filtered.length} tasks · ${shownDone} done`)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))', gap: 12 }}>
        {filtered.map((t) => <TaskCard key={t.id} task={t} onToggle={() => store.toggleTask(t.id)} showOwner showCategory />)}
      </div>
      {!filtered.length && <div style={{ fontSize: 13, color: 'oklch(0.55 0.01 60)', padding: 20, textAlign: 'center' }}>{t('没有符合筛选条件的任务', 'No tasks match these filters')}</div>}
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'oklch(0.55 0.01 60)', width: 52, flex: 'none' }}>{label}</span>
      {children}
    </div>
  );
}
