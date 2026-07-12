import { useState } from 'react';
import type { Store } from '../../hooks/useStore';
import type { PersonId, Priority } from '../../types';
import { DATES, md, weekLabel } from '../../data/moveData';
import { useMembers } from '../../hooks/useMembers';
import { ACCENT, STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../lib/ui';
import { t } from '../../lib/i18n';
import { PageHeader } from '../../components/PageHeader';

const cellSelect: React.CSSProperties = { padding: '6px 8px', border: '1px solid oklch(0.88 0.008 85)', borderRadius: 7, fontSize: 12.5, background: 'white', cursor: 'pointer' };

export function AdminTasks({ store }: { store: Store }) {
  const { tasks } = store;
  const { members } = useMembers();
  const [ntTitle, setNtTitle] = useState('');
  const [ntOwner, setNtOwner] = useState<PersonId>('dad');
  const [ntDate, setNtDate] = useState('07-06');
  const [ntPri, setNtPri] = useState<Priority>('P1');

  const ownerOpts = members.map((p) => ({ v: p.id, l: p.name }));
  const dateOpts = DATES.map((d) => ({ v: d, l: `${md(d)} ${weekLabel(d)}` }));
  const tr = t; // alias for use inside the row .map where `t` is the task param

  const submit = () => {
    store.addTask({ title: ntTitle, owner: ntOwner, date: ntDate, priority: ntPri });
    setNtTitle('');
  };

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · TASKS"
        title={`${t('任务管理', 'Tasks')} ${tasks.length}`}
        subtitle={t('新增、编辑、删除任务，修改负责人 / 日期 / 优先级 / 状态', 'Add, edit, delete tasks; change owner / date / priority / status')}
      />

      {/* add row */}
      <div style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={ntTitle}
          onChange={(e) => setNtTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={t('新任务名称…', 'New task name…')}
          style={{ flex: 1, minWidth: 200, padding: '9px 12px', border: '1px solid oklch(0.88 0.008 85)', borderRadius: 9, fontSize: 13.5, background: 'white' }}
        />
        <select value={ntOwner} onChange={(e) => setNtOwner(e.target.value as PersonId)} style={{ ...cellSelect, padding: '9px 11px' }}>
          {ownerOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <select value={ntDate} onChange={(e) => setNtDate(e.target.value)} style={{ ...cellSelect, padding: '9px 11px' }}>
          {dateOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <select value={ntPri} onChange={(e) => setNtPri(e.target.value as Priority)} style={{ ...cellSelect, padding: '9px 11px' }}>
          {PRIORITY_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <button onClick={submit} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('添加任务', 'Add task')}</button>
      </div>

      {/* rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map((t) => (
          <div key={t.id} style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 11, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={t.title}
                onChange={(e) => store.setTaskField(t.id, 'title', e.target.value)}
                style={{ flex: 1, minWidth: 190, padding: '7px 9px', border: '1px solid transparent', borderRadius: 7, fontSize: 13.5, fontWeight: 500, background: 'oklch(0.98 0.004 85)' }}
              />
              <select value={t.owner} onChange={(e) => store.setTaskField(t.id, 'owner', e.target.value as PersonId)} style={cellSelect}>
                {ownerOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <select value={t.date} onChange={(e) => store.setTaskField(t.id, 'date', e.target.value)} style={cellSelect}>
                {dateOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <select value={t.priority} onChange={(e) => store.setTaskField(t.id, 'priority', e.target.value as Priority)} style={cellSelect}>
                {PRIORITY_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <select value={t.status} onChange={(e) => store.setTaskField(t.id, 'status', e.target.value as typeof t.status)} style={cellSelect}>
                {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <button onClick={() => store.deleteTask(t.id)} style={{ padding: '6px 10px', border: '1px solid oklch(0.88 0.03 30)', borderRadius: 7, fontSize: 12, background: 'white', color: 'oklch(0.55 0.14 30)', cursor: 'pointer' }}>{tr('删除', 'Delete')}</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={t.notes ?? ''} onChange={(e) => store.setTaskField(t.id, 'notes', e.target.value)} placeholder={tr('备注 / 确认号…', 'Notes / confirmation #…')} style={{ flex: 2, minWidth: 150, padding: '6px 9px', border: '1px solid oklch(0.9 0.006 85)', borderRadius: 7, fontSize: 12.5, background: 'oklch(0.985 0.004 85)' }} />
              <input value={t.phone ?? ''} onChange={(e) => store.setTaskField(t.id, 'phone', e.target.value)} placeholder={tr('电话（可点拨）', 'Phone (tap to call)')} style={{ flex: 1, minWidth: 120, padding: '6px 9px', border: '1px solid oklch(0.9 0.006 85)', borderRadius: 7, fontSize: 12.5, background: 'oklch(0.985 0.004 85)' }} />
              <input value={t.link ?? ''} onChange={(e) => store.setTaskField(t.id, 'link', e.target.value)} placeholder={tr('链接 URL', 'Link URL')} style={{ flex: 1, minWidth: 120, padding: '6px 9px', border: '1px solid oklch(0.9 0.006 85)', borderRadius: 7, fontSize: 12.5, background: 'oklch(0.985 0.004 85)' }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
