import type { Task } from '../types';
import { md, TODAY, catLabel } from '../data/moveData';
import { useMembers } from '../hooks/useMembers';
import { ownerBadge, priBadge, statusMeta } from '../lib/ui';
import { t } from '../lib/i18n';

export function CheckBox({ checked, onClick, size = 22 }: { checked: boolean; onClick: () => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      aria-label={checked ? t('标记为未完成', 'Mark as not done') : t('标记为完成', 'Mark as done')}
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        marginTop: 1,
        transition: '.15s',
        border: checked ? '2px solid oklch(0.6 0.13 150)' : '2px solid oklch(0.82 0.01 80)',
        background: checked ? 'oklch(0.6 0.13 150)' : 'white',
      }}
    >
      {checked && (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  showOwner?: boolean;
  showCategory?: boolean;
  showDate?: boolean;
  showDesc?: boolean;
  highlightP0?: boolean;
}

export function TaskCard({
  task,
  onToggle,
  showOwner = false,
  showCategory = false,
  showDate = true,
  showDesc = true,
  highlightP0 = true,
}: TaskCardProps) {
  const { getMember } = useMembers();
  const p = getMember(task.owner);
  const done = task.status === 'done';
  const p0 = task.priority === 'P0';
  const sm = statusMeta(task.status);

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 15px',
        background: 'white',
        border: '1px solid oklch(0.92 0.006 85)',
        borderRadius: 12,
        alignItems: 'flex-start',
        animation: 'fadeup .3s ease',
        boxShadow: p0 && !done && highlightP0 ? 'inset 3px 0 0 oklch(0.58 0.16 25)' : undefined,
      }}
    >
      <CheckBox checked={done} onClick={onToggle} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: 14.5,
            lineHeight: 1.4,
            textDecoration: done ? 'line-through' : undefined,
            color: done ? 'oklch(0.68 0.01 60)' : 'oklch(0.26 0.012 60)',
          }}
        >
          {task.title}
        </div>
        {showDesc && task.description && (
          <div style={{ fontSize: 12, color: 'oklch(0.56 0.01 60)', marginTop: 3, lineHeight: 1.5 }}>
            {task.description}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9, alignItems: 'center' }}>
          {showOwner && <span style={ownerBadge(p.hue)}>{p.name}</span>}
          <span style={priBadge(task.priority)}>{task.priority}</span>
          <span style={sm.style}>{sm.label}</span>
          {showCategory && <span style={{ fontSize: 11, color: 'oklch(0.6 0.01 60)' }}>{catLabel(task.category)}</span>}
          {task.blocking && (
            <span style={{ fontSize: 11, color: 'oklch(0.5 0.16 25)', border: '1px solid oklch(0.85 0.08 25)', padding: '1px 7px', borderRadius: 6 }}>
              {t('阻塞搬家', 'Blocks move')}
            </span>
          )}
          {!done && task.date < TODAY && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'oklch(0.58 0.17 28)', padding: '1px 7px', borderRadius: 6 }}>{t('逾期', 'Overdue')}</span>
          )}
        </div>
        {(task.phone || task.link || task.notes) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, alignItems: 'center', fontSize: 12 }}>
            {task.phone && (
              <a href={`tel:${task.phone}`} onClick={(e) => e.stopPropagation()} style={{ color: 'oklch(0.5 0.1 245)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" /></svg>
                {task.phone}
              </a>
            )}
            {task.link && (
              <a href={task.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'oklch(0.5 0.1 245)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
                {t('链接', 'Link')}
              </a>
            )}
            {task.notes && <span style={{ color: 'oklch(0.5 0.01 60)' }}>📝 {task.notes}</span>}
          </div>
        )}
      </div>
      {showDate && (
        <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12, color: 'oklch(0.62 0.01 60)', flex: 'none' }}>
          {md(task.date)}
        </span>
      )}
    </div>
  );
}
