import type { SharedBoard } from '../hooks/useStore';

export interface LarkResult {
  configured: boolean;
  ok?: boolean;
  error?: string;
}

export async function pushBrief(board: SharedBoard, today: string): Promise<LarkResult> {
  try {
    const room = localStorage.getItem('mg_room') || undefined; // enable in-Lark complete buttons if synced
    const res = await fetch('/api/lark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'brief', board, today, room, appUrl: location.origin + '/' }),
    });
    return await res.json();
  } catch (e) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
}
