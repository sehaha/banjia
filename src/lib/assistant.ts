import type { AssistantAction, ChatMessage } from '../types';

export interface AssistantContext {
  today: string;
  person: string;
  schedule: { date: string; weekday: string; stage: string; goal: string }[];
  members: { id: string; name: string; role: string }[];
  tasks: { title: string; owner: string; date: string; priority: string; status: string; blocking: boolean }[];
  utils: { name: string; provider: string; type: string; status: string; note: string }[];
  docs: { title: string; tag: string; body: string }[];
  memory: string[];
  progress: { total: number; done: number; pct: number; inProgress: number; p0Remaining: number };
}

export interface AssistantResponse {
  reply: string;
  actions: AssistantAction[];
}

export async function askAssistant(messages: ChatMessage[], context: AssistantContext): Promise<AssistantResponse> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  });
  if (!res.ok) throw new Error('网络错误 ' + res.status);
  return res.json();
}
