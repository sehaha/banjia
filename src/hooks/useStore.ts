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
import { t as tr } from '../lib/i18n'; // aliased: `t` is used as the Task param throughout this file

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

const statusLabel = (s: TaskStatus): string => ({
  not_started: tr('未开始', 'Not started'),
  in_progress: tr('进行中', 'In progress'),
  done: tr('已完成', 'Done'),
  issue: tr('有问题', 'Issue'),
}[s]);
const utilLabel = (s: UtilityStatus): string => ({
  not_started: tr('未开通', 'Not set up'),
  in_progress: tr('申请中', 'Applying'),
  done: tr('已确认', 'Confirmed'),
  issue: tr('有问题', 'Issue'),
}[s]);

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
    if (found.length === 0) return { result: { status: 'error', message: tr(`没找到包含「${match}」的任务`, `No task matching “${match}”`) } };
    if (found.length > 1)
      return {
        result: {
          status: 'ambiguous',
          message: tr(`有 ${found.length} 条任务包含「${match}」，你指哪一条？`, `${found.length} tasks match “${match}” — which one?`),
          candidates: found.slice(0, 8).map((tk) => ({ id: tk.id, title: tk.title })),
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
      if (!title) return { result: { status: 'error', message: tr('任务标题为空，未添加', 'Task title is empty — not added') } };
      const nt: Task = {
        id: uid('ai'), title, owner, date: normalizeDate(a.date),
        category: a.category && CATEGORIES.includes(a.category) ? a.category : CATEGORIES[0],
        priority: pri, blocking: pri === 'P0', status: 'not_started', description: '',
      };
      return { result: { status: 'done', message: tr(`已添加「${title}」→ ${memberName(s, owner)}（${nt.date} ${pri}）`, `Added “${title}” → ${memberName(s, owner)} (${nt.date} ${pri})`) }, next: { ...s, tasks: [...s.tasks, nt] } };
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
          return tr(
            `已把「${t.title}」改派给 ${memberName(s, owner)}（TA 名下 ${cnt} 项${overloaded ? '，偏多，考虑分给别人' : ''}）`,
            `Reassigned “${t.title}” to ${memberName(s, owner)} (${cnt} task${cnt > 1 ? 's' : ''} on them${overloaded ? ' — that’s a lot, consider sharing' : ''})`,
          );
        },
        (t) => ({ ...t, owner }),
      );
    }
    case 'set_status':
      return single(a.match, a.id, (t) => tr(`已把「${t.title}」标记为 ${statusLabel(a.status)}`, `Marked “${t.title}” as ${statusLabel(a.status)}`), (t) => ({ ...t, status: a.status }));
    case 'set_priority':
      return single(a.match, a.id, (t) => tr(`已把「${t.title}」设为 ${a.priority}`, `Set “${t.title}” to ${a.priority}`), (t) => ({ ...t, priority: a.priority, blocking: a.priority === 'P0' ? true : t.blocking }));
    case 'set_date': {
      const date = normalizeDate(a.date);
      return single(a.match, a.id, (t) => tr(`已把「${t.title}」改到 ${date}`, `Moved “${t.title}” to ${date}`), (t) => ({ ...t, date }));
    }
    case 'set_blocking':
      return single(a.match, a.id, (t) => tr(`已把「${t.title}」标记为${a.blocking ? '阻塞搬家' : '不阻塞'}`, `Marked “${t.title}” as ${a.blocking ? 'blocking the move' : 'not blocking'}`), (t) => ({ ...t, blocking: a.blocking }));
    case 'delete_task': {
      const found = targets(s, a.match, a.id);
      if (found.length === 0) return { result: { status: 'error', message: tr(`没找到包含「${a.match}」的任务`, `No task matching “${a.match}”`) } };
      if (found.length > 1)
        return { result: { status: 'ambiguous', message: tr(`有 ${found.length} 条任务包含「${a.match}」，删哪一条？`, `${found.length} tasks match “${a.match}” — which to delete?`), candidates: found.slice(0, 8).map((tk) => ({ id: tk.id, title: tk.title })) } };
      const t = found[0];
      if (!confirmed) return { result: { status: 'confirm', message: tr(`确定删除任务「${t.title}」？`, `Delete the task “${t.title}”?`) } };
      return { result: { status: 'done', message: tr(`已删除任务「${t.title}」`, `Deleted “${t.title}”`) }, next: { ...s, tasks: s.tasks.filter((x) => x.id !== t.id) } };
    }
    case 'add_member': {
      const n = a.name.trim();
      if (!n) return { result: { status: 'error', message: tr('成员名为空', 'Member name is empty') } };
      if (s.members.some((m) => m.name === n)) return { result: { status: 'error', message: tr(`成员「${n}」已存在`, `Member “${n}” already exists`) } };
      const member: Person = { id: uid('m'), name: n, role: a.role || tr('家庭成员', 'Family member'), hue: HUE_PALETTE[s.members.length % HUE_PALETTE.length] };
      return { result: { status: 'done', message: tr(`已添加成员「${n}」`, `Added member “${n}”`) }, next: { ...s, members: [...s.members, member] } };
    }
    case 'rename_member': {
      const q = a.match.trim().toLowerCase();
      const target = s.members.find((m) => m.id.toLowerCase() === q || m.name.toLowerCase() === q);
      if (!target) return { result: { status: 'error', message: tr(`没找到成员「${a.match}」`, `No member named “${a.match}”`) } };
      const newName = a.name.trim();
      if (!newName) return { result: { status: 'error', message: tr('新名字为空', 'New name is empty') } };
      return { result: { status: 'done', message: tr(`已把「${target.name}」改名为「${newName}」`, `Renamed “${target.name}” to “${newName}”`) }, next: { ...s, members: s.members.map((m) => (m.id === target.id ? { ...m, name: newName } : m)) } };
    }
    case 'set_utility': {
      const q = a.name.trim().toLowerCase();
      const found = s.utils.filter((u) => u.name.toLowerCase().includes(q) || u.provider.toLowerCase().includes(q));
      if (found.length === 0) return { result: { status: 'error', message: tr(`没找到服务「${a.name}」`, `No service named “${a.name}”`) } };
      const u = found[0];
      return { result: { status: 'done', message: tr(`已把「${u.name}」设为 ${utilLabel(a.status)}`, `Set “${u.name}” to ${utilLabel(a.status)}`) }, next: { ...s, utils: s.utils.map((x) => (x.id === u.id ? { ...x, status: a.status } : x)) } };
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
      if (matched.length === 0) return { result: { status: 'error', message: tr('没有符合条件的任务', 'No tasks match those filters') } };
      const set = a.set || {};
      const setOwner = set.owner ? ownerId(s, set.owner) : undefined;
      const setDate = set.date ? normalizeDate(set.date) : undefined;
      const parts: string[] = [];
      if (setOwner) parts.push(tr(`负责人→${memberName(s, setOwner)}`, `owner → ${memberName(s, setOwner)}`));
      if (set.priority) parts.push(tr(`优先级→${set.priority}`, `priority → ${set.priority}`));
      if (set.status) parts.push(tr(`状态→${statusLabel(set.status)}`, `status → ${statusLabel(set.status)}`));
      if (setDate) parts.push(tr(`日期→${setDate}`, `date → ${setDate}`));
      if (!parts.length) return { result: { status: 'error', message: tr('没有指定要修改的内容', 'Nothing specified to change') } };
      const sep = tr('、', ', ');
      if (!confirmed) return { result: { status: 'confirm', message: tr(`将更新 ${matched.length} 条任务：${parts.join(sep)}`, `Will update ${matched.length} tasks: ${parts.join(sep)}`) } };
      const ids = new Set(matched.map((t) => t.id));
      const apply = (t: Task): Task => (ids.has(t.id) ? { ...t, ...(setOwner ? { owner: setOwner } : {}), ...(set.priority ? { priority: set.priority } : {}), ...(set.status ? { status: set.status } : {}), ...(setDate ? { date: setDate } : {}) } : t);
      return { result: { status: 'done', message: tr(`已更新 ${matched.length} 条任务：${parts.join(sep)}`, `Updated ${matched.length} tasks: ${parts.join(sep)}`) }, next: { ...s, tasks: s.tasks.map(apply) } };
    }
    case 'remember': {
      const note = (a.note || '').trim();
      if (!note) return { result: { status: 'error', message: tr('要记的内容为空', 'Nothing to remember') } };
      if (s.memory.includes(note)) return { result: { status: 'done', message: tr(`我已经记着「${note}」了`, `I already remember “${note}”`) } };
      return { result: { status: 'done', message: tr(`已记住「${note}」`, `Got it — I’ll remember “${note}”`) }, next: { ...s, memory: [...s.memory, note] } };
    }
    default:
      return { result: { status: 'error', message: tr('未知操作', 'Unknown action') } };
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

  const addMember = useCallback((name: string, role = tr('家庭成员', 'Family member')) => {
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
