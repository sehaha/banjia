import { useCallback, useEffect, useRef, useState } from 'react';
import type { Store } from './useStore';

const ROOM_KEY = 'mg_room';
const ON_KEY = 'mg_sync_on';
const CLIENT_KEY = 'mg_client';
const NUDGE_KEY = 'mg_bot_nudge';
const POLL_MS = 4000;
const PUSH_DEBOUNCE_MS = 1200;

function clientId(): string {
  let c = localStorage.getItem(CLIENT_KEY);
  if (!c) { c = Math.random().toString(36).slice(2, 10); localStorage.setItem(CLIENT_KEY, c); }
  return c;
}
export function genRoom(): string {
  const s = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return r;
}
function initialRoom(): string {
  const m = typeof location !== 'undefined' ? location.hash.match(/room=([A-Za-z0-9_-]+)/) : null;
  if (m) return m[1].toUpperCase();
  return localStorage.getItem(ROOM_KEY) || '';
}

export type SyncStatus = 'off' | 'connecting' | 'synced' | 'error' | 'unconfigured';

export interface Sync {
  enabled: boolean;
  room: string;
  status: SyncStatus;
  start: (room?: string) => void;
  stop: () => void;
  roomLink: string;
  /** Unseen updates pushed by the Lark bot while this tab was open. */
  botNudge: { count: number; titles: string[] };
  clearNudge: () => void;
  /** Whether to badge bot updates at all (user-toggleable, persisted). */
  nudgeEnabled: boolean;
  setNudgeEnabled: (v: boolean) => void;
}

interface Envelope {
  data: ReturnType<Store['getShared']>;
  rev: number;
  updatedAt: number;
  origin: string;
}

export function useSync(store: Store): Sync {
  const [room, setRoom] = useState<string>(initialRoom);
  const [enabled, setEnabled] = useState<boolean>(() =>
    (typeof location !== 'undefined' && /room=/.test(location.hash)) || localStorage.getItem(ON_KEY) === '1',
  );
  const [status, setStatus] = useState<SyncStatus>('off');
  const [botNudge, setBotNudge] = useState<{ count: number; titles: string[] }>({ count: 0, titles: [] });
  const [nudgeEnabled, setNudgeEnabledState] = useState<boolean>(() => localStorage.getItem(NUDGE_KEY) !== '0');
  const nudgeEnabledRef = useRef(nudgeEnabled); nudgeEnabledRef.current = nudgeEnabled;

  const storeRef = useRef(store); storeRef.current = store;
  const roomRef = useRef(room); roomRef.current = room;
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const cid = useRef<string>('');
  const lastHash = useRef<string>('');
  const lastAppliedAt = useRef<number>(0);
  const revRef = useRef<number>(0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { cid.current = clientId(); }, []);

  const push = useCallback(async (force = false) => {
    if (!enabledRef.current || !roomRef.current) return;
    const data = storeRef.current.getShared();
    const str = JSON.stringify(data);
    if (!force && str === lastHash.current) return;
    revRef.current += 1;
    const updatedAt = Date.now();
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomRef.current, envelope: { data, rev: revRef.current, updatedAt, origin: cid.current } }),
      });
      const j = await res.json();
      if (j.configured === false) { setStatus('unconfigured'); return; }
      if (j.ok) { lastHash.current = str; lastAppliedAt.current = updatedAt; setStatus('synced'); }
      else setStatus('error');
    } catch { setStatus('error'); }
  }, []);

  const pull = useCallback(async (initial: boolean) => {
    if (!enabledRef.current || !roomRef.current) return;
    try {
      const res = await fetch(`/api/sync?room=${encodeURIComponent(roomRef.current)}`);
      const j = await res.json();
      if (j.configured === false) { setStatus('unconfigured'); return; }
      const env: Envelope | null = j.envelope || null;
      // Adopt any change that isn't our own echo. We key on origin + content, NOT
      // wall-clock `updatedAt`: the bot stamps writes with the server clock while
      // web clients use their device clock, so a skewed device clock would make
      // `updatedAt` comparisons drop the bot's changes. `rev`/`updatedAt` are only
      // carried forward as hints.
      if (env && env.data && env.origin !== cid.current) {
        const remoteHash = JSON.stringify(env.data);
        if (remoteHash !== lastHash.current) {
          const prev = storeRef.current.getShared();
          // set the hash first so our own change-effect doesn't echo it back
          lastHash.current = remoteHash;
          lastAppliedAt.current = Math.max(lastAppliedAt.current, env.updatedAt || 0);
          revRef.current = Math.max(revRef.current, env.rev || 0);
          storeRef.current.applyRemote(env.data);
          // Nudge when the Lark bot changed things mid-session (skip the initial
          // load so old bot activity doesn't badge on every page open).
          if (!initial && env.origin === 'lark' && nudgeEnabledRef.current) {
            const prevTitles = new Set((prev.tasks || []).map((t) => t.title));
            const added = (env.data.tasks || []).map((t) => t.title).filter((t) => !prevTitles.has(t));
            setBotNudge((b) => ({ count: b.count + 1, titles: [...added, ...b.titles].slice(0, 5) }));
          }
        }
        setStatus('synced');
      } else if (!env && initial) {
        // room is empty — seed it with our current board (force past the hash guard)
        push(true);
      } else {
        setStatus('synced');
      }
    } catch { setStatus('error'); }
  }, [push]);

  // Poll loop + initial sync, keyed on room/enabled.
  useEffect(() => {
    if (!enabled || !room) { setStatus('off'); return; }
    setStatus('connecting');
    lastAppliedAt.current = 0;
    lastHash.current = JSON.stringify(storeRef.current.getShared());
    pull(true);
    const id = setInterval(() => pull(false), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, room, pull]);

  // Push local shared-board changes (debounced) while synced.
  useEffect(() => {
    if (!enabled || !room) return;
    if (JSON.stringify(store.getShared()) === lastHash.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => push(), PUSH_DEBOUNCE_MS);
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
  }, [store.tasks, store.utils, store.docs, store.members, store.memory, enabled, room, push, store]);

  const start = useCallback((r?: string) => {
    const code = (r || roomRef.current || genRoom()).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    localStorage.setItem(ROOM_KEY, code);
    localStorage.setItem(ON_KEY, '1');
    setRoom(code);
    setEnabled(true);
  }, []);

  const stop = useCallback(() => {
    localStorage.setItem(ON_KEY, '0');
    setEnabled(false);
    setStatus('off');
  }, []);

  const roomLink = typeof location !== 'undefined' && room ? `${location.origin}/#room=${room}` : '';
  const clearNudge = useCallback(() => setBotNudge({ count: 0, titles: [] }), []);
  const setNudgeEnabled = useCallback((v: boolean) => {
    localStorage.setItem(NUDGE_KEY, v ? '1' : '0');
    setNudgeEnabledState(v);
    if (!v) setBotNudge({ count: 0, titles: [] }); // clear any pending badge when turned off
  }, []);

  return { enabled, room, status, start, stop, roomLink, botNudge, clearNudge, nudgeEnabled, setNudgeEnabled };
}
