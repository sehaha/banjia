import { useState } from 'react';
import type { Store } from '../../hooks/useStore';
import { useMembers } from '../../hooks/useMembers';
import { ACCENT } from '../../lib/ui';
import { t } from '../../lib/i18n';
import { PageHeader } from '../../components/PageHeader';

export function AdminPeople({ store }: { store: Store }) {
  const { tasks } = store;
  const { members } = useMembers();
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  const cards = members.map((p) => {
    const list = tasks.filter((t) => t.owner === p.id);
    const dn = list.filter((t) => t.status === 'done').length;
    const pc = list.length ? Math.round((dn / list.length) * 100) : 0;
    const p0 = list.filter((t) => t.priority === 'P0' && t.status !== 'done').length;
    return { ...p, done: dn, total: list.length, pct: pc, p0 };
  });

  const addMember = () => {
    if (!newName.trim()) return;
    store.addMember(newName, newRole.trim() || undefined);
    setNewName('');
    setNewRole('');
  };

  return (
    <>
      <PageHeader eyebrow="ADMIN · PEOPLE" title={t('成员管理', 'People')} subtitle={t('修改成员名称与职责、添加或删除成员（删除后其任务会转给「全家」）', 'Edit names and roles, add or remove members (a removed member’s tasks move to “Everyone”)')} />

      {/* add member row */}
      <div style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addMember(); }}
          placeholder={t('新成员名称…', 'New member name…')}
          style={{ flex: 1, minWidth: 160, padding: '9px 12px', border: '1px solid oklch(0.88 0.008 85)', borderRadius: 9, fontSize: 13.5, background: 'white' }}
        />
        <input
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addMember(); }}
          placeholder={t('职责（可选）', 'Role (optional)')}
          style={{ flex: 1, minWidth: 160, padding: '9px 12px', border: '1px solid oklch(0.88 0.008 85)', borderRadius: 9, fontSize: 13.5, background: 'white' }}
        />
        <button onClick={addMember} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('添加成员', 'Add member')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
        {cards.map((p) => (
          <div key={p.id} style={{ background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#fff', background: `oklch(0.58 0.13 ${p.hue})` }}>{p.name.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <input
                  value={p.name}
                  onChange={(e) => store.renameMember(p.id, e.target.value)}
                  style={{ fontWeight: 700, fontSize: 15, padding: '4px 7px', border: '1px solid transparent', borderRadius: 6, background: 'oklch(0.98 0.004 85)', width: '100%' }}
                />
                <input
                  value={p.role}
                  onChange={(e) => store.setMemberRole(p.id, e.target.value)}
                  placeholder={t('职责', 'Role')}
                  style={{ fontSize: 11.5, color: 'oklch(0.5 0.01 60)', padding: '3px 7px', border: '1px solid transparent', borderRadius: 6, background: 'oklch(0.98 0.004 85)', width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
              <span style={{ color: 'oklch(0.55 0.01 60)' }}>{t('完成进度', 'Progress')}</span>
              <span style={{ fontFamily: "'Space Grotesk'" }}>{p.done}/{p.total} · {p.pct}%</span>
            </div>
            <div style={{ height: 8, background: 'oklch(0.93 0.006 85)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p.pct}%`, background: `oklch(0.6 0.13 ${p.hue})`, borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
              <MiniStat value={p.total} label={t('总任务', 'Total')} />
              <MiniStat value={p.p0} label={t('P0 待办', 'P0 to-do')} color="oklch(0.58 0.16 30)" />
              <button
                onClick={() => { if (confirm(t(`删除成员「${p.name}」？TA 名下的任务会转给「全家」。`, `Remove “${p.name}”? Their tasks will move to “Everyone”.`))) store.deleteMember(p.id); }}
                disabled={members.length <= 1}
                title={t('删除成员', 'Remove member')}
                style={{ flex: 'none', padding: '8px 10px', border: '1px solid oklch(0.88 0.03 30)', borderRadius: 8, fontSize: 12, background: 'white', color: 'oklch(0.55 0.14 30)', cursor: members.length <= 1 ? 'not-allowed' : 'pointer', opacity: members.length <= 1 ? 0.4 : 1 }}
              >
                {t('删除', 'Delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MiniStat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ flex: 1, background: 'oklch(0.98 0.004 85)', borderRadius: 9, padding: 9, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Space Grotesk'", fontSize: 17, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'oklch(0.58 0.01 60)' }}>{label}</div>
    </div>
  );
}
