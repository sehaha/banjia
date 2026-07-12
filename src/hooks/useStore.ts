import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task, Utility, DocTemplate, Person, PersonId, TaskStatus, UtilityStatus, Priority, AssistantAction, ApplyResult } from '../types';
import {
  INITIAL_TASKS,
  INITIAL_UTILITIES,
  INITIAL_DOCS,
  INITIAL_MEMBERS,
  CATEGORIES,
  DATES,
} from '../data/moveData';

const LS_KEY = 'moveguide_v2';

// Hues for auto-assigning colors to newly added members.
const HUE_PALETTE = [245, 8, 65, 160, 300, 200, 40, 120, 280, 340, 90, 20];

// Monotonic sequence guarantees unique ids even when several items are created
// within the same millisecond — e.g. the assistant applying multiple add_task
// actions in one turn. Before this, `Date.now()`-only ids collided, so toggling
// one AI-added task also toggled its same-tick siblings.
let idSeq = 0;
function uid(prefix: string): string {
  idSeq += 1;
  return `${prefix}${Date.now().toString(36)}-${idSeq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// Give any items that share an id a fresh unique id (repairs data saved by the
// old colliding-id logic). Keeps the first occurrence, reassigns the rest.
function dedupeIds<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.map((it) => {
    if (seen.has(it.id)) return { ...it, id: uid('fix') };
    seen.add(it.id);
    return it;
  });
}

interface Persisted {
  tasks: Task[];
  utils: Utility[];
  docs: DocTemplate[];
  members: Person[];
  person: PersonId;
  memory: string[]; // facts the assistant remembers across sessions
}

function loadInitial(): Persisted {
  const fallback: Persisted = {
    tasks: INITIAL_TASKS,
    utils: INITIAL_UTILITIES,
    docs: INITIAL_DOCS,
    members: INITIAL_MEMBERS,
    person: 'dad',
    memory: [],
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    // Robust merge: always keep a full dataset even if storage is partial.
    // dedupeIds repairs any colliding ids left by the old id logic.
    return {
      tasks: dedupeIds(Array.isArray(parsed.tasks) && parsed.tasks.length ? parsed.tasks : INITIAL_TASKS),
      utils: Array.isArray(parsed.utils) && parsed.utils.length ? parsed.utils : INITIAL_UTILITIES,
      docs: Array.isArray(parsed.docs) && parsed.docs.length ? parsed.docs : INITIAL_DOCS,
      members: dedupeIds(Array.isArray(parsed.members) && parsed.members.length ? parsed.members : INITIAL_MEMBERS),
      person: (parsed.person as PersonId) || 'dad',
      memory: Array.isArray(parsed.memory) ? parsed.memory : [],
    };
  } catch {
    return fallback;
  }
}

// Normalize a date string to 'MM-DD' (accepts 'M/D', 'MM-DD', 'M-D').
function normalizeDate(d: string | undefined): string {
  if (!d) return DATES[0];
  const m = d.match(/(\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return DATES[0];
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: '未开始', in_progress: '进行中', done: '已完成', issue: '有问题',
};

// ---------- pure action applier (operates over a snapshot, returns result + next state) ----------

function ownerId(s: Persisted, nameOrId?: string): PersonId {
  const fallback = s.members.find((m) => m.id === 'family')?.id ?? s.members[0].id;
  if (!nameOrId) return fallback;
  const q = nameOrId.trim().toLowerCase();
  const hit = s.members.find((m) => m.id.toLowerCase() === q || m.name.toLowerCase() === q);
  return hit ? hit.id : fallback;
}
function memberName(s: Persisted, id: PersonId): string {
  return s.members.find((m) => m.id === id)?.name ?? id;
}
// Resolve which task(s) an action targets: pinned id wins, else fuzzy title match.
function targets(s: Persisted, match: string, id?: string): Task[] {
  if (id) return s.tasks.filter((t) => t.id === id);
  const q = (match || '').trim().toLowerCase();
  if (!q) return [];
  return s.tasks.filter((t) => t.title.toLowerCase().includes(q));
}

interface Applied {
  result: ApplyResult;
  next?: Persisted; // present only when something actually changed
}

export function computeAction(s: Persisted, a: AssistantAction, confirmed: boolean): Applied {
  // Single-target task action: resolve then apply `mut`, with disambiguation.
  const single = (
    match: string,
    id: string | undefined,
    describe: (t: Task) => string,
    mut: (t: Task) => Task,
  ): Applied => {
    const found = targets(s, match, id);
    if (found.length === 0) return { result: { status: 'error', message: `没找到包含「${match}」的任务` } };
    if (found.length > 1)
      return {
        result: {
          status: 'ambiguous',
          message: `有 ${found.length} 条任务包含「${match}」，你指哪一条？`,
          candidates: found.slice(0, 8).map((t) => ({ id: t.id, title: t.title })),
        },
      };
    const t = found[0];
    return { result: { status: 'done', message: describe(t) }, next: { ...s, tasks: s.tasks.map((x) => (x.id === t.id ? mut(x) : x)) } };
  };

  switch (a.type) {
    case 'add_task': {
      const owner = ownerId(s, a.owner);
      const pri = (a.priority as Priority) || 'P1';
      const title = a.title.trim();
      if (!title) return { result: { status: 'error', message: '任务标题为空，未添加' } };
      const nt: Task = {
        id: uid('ai'), title, owner, date: normalizeDate(a.date),
        category: a.category && CATEGORIES.includes(a.category) ? a.category : CATEGORIES[0],
        priority: pri, blocking: pri === 'P0', status: 'not_started', description: '',
      };
      return { result: { status: 'done', message: `已添加「${title}」→ ${memberName(s, owner)}（${nt.date} ${pri}）` }, next: { ...s, tasks: [...s.tasks, nt] } };
    }
    case 'reassign': {
      const owner = ownerId(s, a.owner);
      return single(
        a.match,
        a.id,
        (t) => {
          // Post-reassign load for the assignee, with a gentle overload hint (team feel).
          const cnt = s.tasks.filter((x) => x.owner === owner && x.id !== t.id).length + 1;
          const counts = s.members.map((m) => s.tasks.filter((x) => (x.id === t.id ? owner : x.owner) === m.id).length);
          const avg = counts.reduce((sum, n) => sum + n, 0) / (counts.length || 1);
          const overloaded = cnt >= 4 && cnt > avg * 1.4 && cnt === Math.max(...counts);
          return `已把「${t.title}」改派给 ${memberName(s, owner)}（TA 名下 ${cnt} 项${overloaded ? '，偏多，考虑分给别人' : ''}）`;
        },
        (t) => ({ ...t, owner }),
      );
    }
    case 'set_status':
      return single(a.match, a.id, (t) => `已把「${t.title}」标记为 ${STATUS_LABEL[a.status]}`, (t) => ({ ...t, status: a.status }));
    case 'set_priority':
      return single(a.match, a.id, (t) => `已把「${t.title}」设为 ${a.priority}`, (t) => ({ ...t, priority: a.priority, blocking: a.priority === 'P0' ? true : t.blocking }));
    case 'set_date': {
      const date = normalizeDate(a.date);
      return single(a.match, a.id, (t) => `已把「${t.title}」改到 ${date}`, (t) => ({ ...t, date }));
    }
    case 'set_blocking':
      return single(a.match, a.id, (t) => `已把「${t.title}」标记为${a.blocking ? '阻塞搬家' : '不阻塞'}`, (t) => ({ ...t, blocking: a.blocking }));
    case 'delete_task': {
      const found = targets(s, a.match, a.id);
      if (found.length === 0) return { result: { status: 'error', message: `没找到包含「${a.match}」的任务` } };
      if (found.length > 1)
        return { result: { status: 'ambiguous', message: `有 ${found.length} 条任务包含「${a.match}」，删哪一条？`, candidates: found.slice(0, 8).map((t) => ({ id: t.id, title: t.title })) } };
      const t = found[0];
      if (!confirmed) return { result: { status: 'confirm', message: `确定删除任务「${t.title}」？` } };
      return { result: { status: 'done', message: `已删除任务「${t.title}」` }, next: { ...s, tasks: s.tasks.filter((x) => x.id !== t.id) } };
    }
    case 'add_member': {
      const n = a.name.trim();
      if (!n) return { result: { status: 'error', message: '成员名为空' } };
      if (s.members.some((m) => m.name === n)) return { result: { status: 'error', message: `成员「${n}」已存在` } };
      const member: Person = { id: uid('m'), name: n, role: a.role || '家庭成员', hue: HUE_PALETTE[s.members.length % HUE_PALETTE.length] };
      return { result: { status: 'done', message: `已添加成员「${n}」` }, next: { ...s, members: [...s.members, member] } };
    }
    case 'rename_member': {
      const q = a.match.trim().toLowerCase();
      const target = s.members.find((m) => m.id.toLowerCase() === q || m.name.toLowerCase() === q);
      if (!target) return { result: { status: 'error', message: `没找到成员「${a.match}」` } };
      const newName = a.name.trim();
      if (!newName) return { result: { status: 'error', message: '新名字为空' } };
      return { result: { status: 'done', message: `已把「${target.name}」改名为「${newName}」` }, next: { ...s, members: s.members.map((m) => (m.id === target.id ? { ...m, name: newName } : m)) } };
    }
    case 'set_utility': {
      const q = a.name.trim().toLowerCase();
      const found = s.utils.filter((u) => u.name.toLowerCase().includes(q) || u.provider.toLowerCase().includes(q));
      if (found.length === 0) return { result: { status: 'error', message: `没找到服务「${a.name}」` } };
      const u = found[0];
      const label = { not_started: '未开通', in_progress: '申请中', done: '已确认', issue: '有问题' }[a.status];
      return { result: { status: 'done', message: `已把「${u.name}」设为 ${label}` }, next: { ...s, utils: s.utils.map((x) => (x.id === u.id ? { ...x, status: a.status } : x)) } };
    }
    case 'bulk_update': {
      const f = a.filter || {};
      const fOwner = f.owner ? ownerId(s, f.owner) : undefined;
      const fDate = f.date ? normalizeDate(f.date) : undefined;
      const matched = s.tasks.filter(
        (t) =>
          (!fOwner || t.owner === fOwner) &&
          (!f.priority || t.priority === f.priority) &&
          (!fDate || t.date === fDate) &&
          (!f.category || t.category === f.category),
      );
      if (matched.length === 0) return { result: { status: 'error', message: '没有符合条件的任务' } };
      const set = a.set || {};
      const setOwner = set.owner ? ownerId(s, set.owner) : undefined;
      const setDate = set.date ? normalizeDate(set.date) : undefined;
      const parts: string[] = [];
      if (setOwner) parts.push(`负责人→${memberName(s, setOwner)}`);
      if (set.priority) parts.push(`优先级→${set.priority}`);
      if (set.status) parts.push(`状态→${STATUS_LABEL[set.status]}`);
      if (setDate) parts.push(`日期→${setDate}`);
      if (!parts.length) return { result: { status: 'error', message: '没有指定要修改的内容' } };
      if (!confirmed) return { result: { status: 'confirm', message: `将更新 ${matched.length} 条任务：${parts.join('、')}` } };
      const ids = new Set(matched.map((t) => t.id));
      const apply = (t: Task): Task => (ids.has(t.id) ? { ...t, ...(setOwner ? { owner: setOwner } : {}), ...(set.priority ? { priority: set.priority } : {}), ...(set.status ? { status: set.status } : {}), ...(setDate ? { date: setDate } : {}) } : t);
      return { result: { status: 'done', message: `已更新 ${matched.length} 条任务：${parts.join('、')}` }, next: { ...s, tasks: s.tasks.map(apply) } };
    }
    case 'remember': {
      const note = (a.note || '').trim();
      if (!note) return { result: { status: 'error', message: '要记的内容为空' } };
      if (s.memory.includes(note)) return { result: { status: 'done', message: `我已经记着「${note}」了` } };
      return { result: { status: 'done', message: `已记住「${note}」` }, next: { ...s, memory: [...s.memory, note] } };
    }
    default:
      return { result: { status: 'error', message: '未知操作' } };
  }
}

// The shared, synced subset of the board. `person` (each device's own identity)
// is intentionally NOT shared.
export interface SharedBoard {
  tasks: Task[];
  utils: Utility[];
  docs: DocTemplate[];
  members: Person[];
  memory: string[];
}

export interface Store {
  tasks: Task[];
  utils: Utility[];
  docs: DocTemplate[];
  members: Person[];
  person: PersonId;
  memory: string[];
  clearMemory: () => void;
  // sync
  getShared: () => SharedBoard;
  applyRemote: (b: SharedBoard) => void;
  setPerson: (id: PersonId) => void;
  toggleTask: (id: string) => void;
  setTaskField: <K extends keyof Task>(id: string, field: K, val: Task[K]) => void;
  addTask: (t: { title: string; owner: PersonId; date: string; priority: Priority }) => void;
  deleteTask: (id: string) => void;
  cycleUtil: (id: string) => void;
  setUtilField: <K extends keyof Utility>(id: string, field: K, val: Utility[K]) => void;
  updateDoc: (id: string, body: string) => void;
  addMember: (name: string, role?: string) => void;
  renameMember: (id: PersonId, name: string) => void;
  setMemberRole: (id: PersonId, role: string) => void;
  deleteMember: (id: PersonId) => void;
  // assistant
  applyAction: (a: AssistantAction, confirmed?: boolean) => ApplyResult;
  undo: () => void;
  canUndo: boolean;
  // data management
  exportData: () => void;
  importData: (json: string) => boolean;
  resetAll: () => void;
}

export function useStore(): Store {
  const [state, setState] = useState<Persisted>(loadInitial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const undoRef = useRef<Persisted | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — non-fatal */
    }
  }, [state]);

  const setPerson = useCallback((id: PersonId) => setState((s) => ({ ...s, person: id })), []);

  const toggleTask = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: t.status === 'done' ? ('not_started' as TaskStatus) : ('done' as TaskStatus) } : t)),
    }));
  }, []);

  const setTaskField = useCallback(<K extends keyof Task>(id: string, field: K, val: Task[K]) => {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, [field]: val } : t)) }));
  }, []);

  const addTask = useCallback((t: { title: string; owner: PersonId; date: string; priority: Priority }) => {
    const title = t.title.trim();
    if (!title) return;
    const nt: Task = { id: uid('k'), title, owner: t.owner, date: t.date, category: CATEGORIES[0], priority: t.priority, blocking: t.priority === 'P0', status: 'not_started', description: '' };
    setState((s) => ({ ...s, tasks: [...s.tasks, nt] }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  const cycleUtil = useCallback((id: string) => {
    const order: UtilityStatus[] = ['not_started', 'in_progress', 'done'];
    setState((s) => ({ ...s, utils: s.utils.map((u) => (u.id === id ? { ...u, status: order[(order.indexOf(u.status) + 1) % order.length] } : u)) }));
  }, []);

  const setUtilField = useCallback(<K extends keyof Utility>(id: string, field: K, val: Utility[K]) => {
    setState((s) => ({ ...s, utils: s.utils.map((u) => (u.id === id ? { ...u, [field]: val } : u)) }));
  }, []);

  const updateDoc = useCallback((id: string, body: string) => {
    setState((s) => ({ ...s, docs: s.docs.map((d) => (d.id === id ? { ...d, body } : d)) }));
  }, []);

  const addMember = useCallback((name: string, role = '家庭成员') => {
    const n = name.trim();
    if (!n) return;
    setState((s) => {
      if (s.members.some((m) => m.name === n)) return s;
      const member: Person = { id: uid('m'), name: n, role, hue: HUE_PALETTE[s.members.length % HUE_PALETTE.length] };
      return { ...s, members: [...s.members, member] };
    });
  }, []);

  const renameMember = useCallback((id: PersonId, name: string) => {
    const n = name.trim();
    if (!n) return;
    setState((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, name: n } : m)) }));
  }, []);

  const setMemberRole = useCallback((id: PersonId, role: string) => {
    setState((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, role } : m)) }));
  }, []);

  const deleteMember = useCallback((id: PersonId) => {
    setState((s) => {
      if (s.members.length <= 1) return s;
      const remaining = s.members.filter((m) => m.id !== id);
      const fallbackOwner = remaining.find((m) => m.id === 'family')?.id ?? remaining[0].id;
      return { ...s, members: remaining, tasks: s.tasks.map((t) => (t.owner === id ? { ...t, owner: fallbackOwner } : t)), person: s.person === id ? fallbackOwner : s.person };
    });
  }, []);

  // ---- assistant ----
  const applyAction = useCallback((a: AssistantAction, confirmed = false): ApplyResult => {
    const s = stateRef.current;
    const { result, next } = computeAction(s, a, confirmed);
    if (next) {
      undoRef.current = s; // snapshot for one-step undo
      setCanUndo(true);
      setState(next);
    }
    return result;
  }, []);

  const undo = useCallback(() => {
    if (undoRef.current) {
      setState(undoRef.current);
      undoRef.current = null;
      setCanUndo(false);
    }
  }, []);

  const clearMemory = useCallback(() => setState((s) => ({ ...s, memory: [] })), []);

  // ---- sync ----
  const getShared = useCallback((): SharedBoard => {
    const s = stateRef.current;
    return { tasks: s.tasks, utils: s.utils, docs: s.docs, members: s.members, memory: s.memory };
  }, []);

  const applyRemote = useCallback((b: SharedBoard) => {
    setState((s) => ({
      ...s,
      tasks: Array.isArray(b.tasks) ? dedupeIds(b.tasks) : s.tasks,
      utils: Array.isArray(b.utils) ? b.utils : s.utils,
      docs: Array.isArray(b.docs) ? b.docs : s.docs,
      members: Array.isArray(b.members) && b.members.length ? dedupeIds(b.members) : s.members,
      memory: Array.isArray(b.memory) ? b.memory : s.memory,
      // keep local `person`
    }));
  }, []);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(stateRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `move-guide-进度-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const importData = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as Partial<Persisted>;
      if (!Array.isArray(parsed.tasks)) return false;
      setState((s) => ({
        tasks: parsed.tasks!.length ? dedupeIds(parsed.tasks as Task[]) : s.tasks,
        utils: Array.isArray(parsed.utils) && parsed.utils.length ? (parsed.utils as Utility[]) : s.utils,
        docs: Array.isArray(parsed.docs) && parsed.docs.length ? (parsed.docs as DocTemplate[]) : s.docs,
        members: Array.isArray(parsed.members) && parsed.members.length ? dedupeIds(parsed.members as Person[]) : s.members,
        person: (parsed.person as PersonId) || s.person,
        memory: Array.isArray(parsed.memory) ? (parsed.memory as string[]) : s.memory,
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetAll = useCallback(() => {
    undoRef.current = null;
    setCanUndo(false);
    setState({ tasks: INITIAL_TASKS, utils: INITIAL_UTILITIES, docs: INITIAL_DOCS, members: INITIAL_MEMBERS, person: 'dad', memory: [] });
  }, []);

  return {
    ...state,
    setPerson,
    toggleTask,
    setTaskField,
    addTask,
    deleteTask,
    cycleUtil,
    setUtilField,
    updateDoc,
    addMember,
    renameMember,
    setMemberRole,
    deleteMember,
    clearMemory,
    getShared,
    applyRemote,
    applyAction,
    undo,
    canUndo,
    exportData,
    importData,
    resetAll,
  };
}
