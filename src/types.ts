// ==== Core domain types for Move Guide ====

export type Priority = 'P0' | 'P1' | 'P2';

// Four task states per PRD §7.2
export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'issue';

// Person ids. Defaults are dad/mom/tommy/kids/family; new members get generated ids,
// so this is a string alias rather than a closed union.
export type PersonId = string;

export interface Person {
  id: PersonId;
  name: string;
  role: string;
  hue: number; // oklch hue for the person's accent color
}

export interface Task {
  id: string;
  title: string;
  owner: PersonId;
  date: string; // 'MM-DD', e.g. '07-06'
  category: string;
  priority: Priority;
  blocking: boolean;
  status: TaskStatus;
  description: string;
  notes?: string; // free-form note / 确认号 / 收据号
  phone?: string; // tap-to-call number (搬家公司 / 中介 …)
  link?: string; // related URL
}

export type UtilityStatus = 'not_started' | 'in_progress' | 'done' | 'issue';

export interface Utility {
  id: string;
  type: 'new' | 'old';
  name: string;
  provider: string;
  address: string;
  start: string;
  status: UtilityStatus;
  note: string;
}

export interface DocTemplate {
  id: string;
  title: string;
  tag: string;
  body: string;
}

// ==== AI assistant actions (emitted by the assistant, applied on the client) ====
// The single-target task actions accept an optional `id`: when the client
// disambiguates a fuzzy `match`, it re-issues the action pinned to one task id.
export interface BulkFilter {
  owner?: string;
  priority?: Priority;
  date?: string;
  category?: string;
}
export interface BulkSet {
  owner?: string;
  priority?: Priority;
  status?: TaskStatus;
  date?: string;
}

export type AssistantAction =
  | { type: 'add_task'; title: string; owner?: string; date?: string; priority?: Priority; category?: string }
  | { type: 'reassign'; match: string; owner: string; id?: string }
  | { type: 'set_status'; match: string; status: TaskStatus; id?: string }
  | { type: 'set_priority'; match: string; priority: Priority; id?: string }
  | { type: 'set_date'; match: string; date: string; id?: string }
  | { type: 'set_blocking'; match: string; blocking: boolean; id?: string }
  | { type: 'delete_task'; match: string; id?: string }
  | { type: 'add_member'; name: string; role?: string }
  | { type: 'rename_member'; match: string; name: string }
  | { type: 'set_utility'; name: string; status: UtilityStatus }
  | { type: 'bulk_update'; filter: BulkFilter; set: BulkSet }
  | { type: 'remember'; note: string };

// Result of applying one action, so the UI can disambiguate / confirm / undo.
export type ApplyResult =
  | { status: 'done'; message: string }
  | { status: 'error'; message: string }
  | { status: 'ambiguous'; message: string; candidates: { id: string; title: string }[] }
  | { status: 'confirm'; message: string };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
