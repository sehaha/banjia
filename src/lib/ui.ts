import type { Priority, TaskStatus, UtilityStatus } from '../types';
import { t } from './i18n';

// Accent color from the design draft (deep green)
export const ACCENT = '#3E7A62';
export const ACCENT_DARK = '#2f5d4b';

// ==== Badge / meta style helpers (ported from the design draft) ====

export function ownerBadge(hue: number): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 9px',
    borderRadius: 999,
    background: `oklch(0.95 0.03 ${hue})`,
    color: `oklch(0.45 0.13 ${hue})`,
    whiteSpace: 'nowrap',
  };
}

const PRI_META: Record<Priority, { h: number; c: number }> = {
  P0: { h: 25, c: 0.16 },
  P1: { h: 70, c: 0.13 },
  P2: { h: 80, c: 0.01 },
};

export function priBadge(p: Priority): React.CSSProperties {
  const m = PRI_META[p] || PRI_META.P2;
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: `oklch(0.95 ${m.c * 0.35} ${m.h})`,
    color: `oklch(0.48 ${m.c} ${m.h})`,
  };
}

const STATUS_META: Record<TaskStatus, { zh: string; en: string; h: number; c: number }> = {
  not_started: { zh: '未开始', en: 'Not started', h: 80, c: 0.01 },
  in_progress: { zh: '进行中', en: 'In progress', h: 245, c: 0.11 },
  done: { zh: '已完成', en: 'Done', h: 150, c: 0.12 },
  issue: { zh: '有问题', en: 'Issue', h: 25, c: 0.16 },
};

export function statusMeta(s: TaskStatus) {
  const m = STATUS_META[s] || STATUS_META.not_started;
  return {
    label: t(m.zh, m.en),
    style: {
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 9px',
      borderRadius: 999,
      background: `oklch(0.95 ${m.c * 0.35} ${m.h})`,
      color: `oklch(0.46 ${m.c} ${m.h})`,
    } as React.CSSProperties,
  };
}

const UTIL_META: Record<UtilityStatus, { zh: string; en: string; h: number; c: number }> = {
  not_started: { zh: '未开通', en: 'Not set up', h: 80, c: 0.01 },
  in_progress: { zh: '申请中', en: 'Applying', h: 245, c: 0.11 },
  done: { zh: '已确认', en: 'Confirmed', h: 150, c: 0.12 },
  issue: { zh: '有问题', en: 'Issue', h: 25, c: 0.16 },
};

export function utilMeta(s: UtilityStatus) {
  const m = UTIL_META[s] || UTIL_META.not_started;
  return { label: t(m.zh, m.en), h: m.h, c: m.c };
}

// Status labels for the 4-state cycle in admin selects (getters so language
// switches are reflected without rebuilding the arrays).
export const STATUS_OPTIONS: { v: TaskStatus; l: string }[] = [
  { v: 'not_started', get l() { return t('未开始', 'Not started'); } },
  { v: 'in_progress', get l() { return t('进行中', 'In progress'); } },
  { v: 'done', get l() { return t('已完成', 'Done'); } },
  { v: 'issue', get l() { return t('有问题', 'Issue'); } },
];

export const UTIL_STATUS_OPTIONS: { v: UtilityStatus; l: string }[] = [
  { v: 'not_started', get l() { return t('未开通', 'Not set up'); } },
  { v: 'in_progress', get l() { return t('申请中', 'Applying'); } },
  { v: 'done', get l() { return t('已确认', 'Confirmed'); } },
  { v: 'issue', get l() { return t('有问题', 'Issue'); } },
];

export const PRIORITY_OPTIONS: { v: Priority; l: string }[] = [
  { v: 'P0', l: 'P0' },
  { v: 'P1', l: 'P1' },
  { v: 'P2', l: 'P2' },
];
