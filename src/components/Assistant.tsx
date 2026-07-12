import { useEffect, useRef, useState } from 'react';
import type { Store } from '../hooks/useStore';
import type { AssistantAction, ApplyResult, ChatMessage } from '../types';
import { TODAY, WEEK, DATES, STAGE, GOAL, md } from '../data/moveData';
import { askAssistant, type AssistantContext } from '../lib/assistant';
import { ACCENT } from '../lib/ui';
import { t, curLang, useI18n } from '../lib/i18n';

const GREETING_ID = 'greeting';
const greetingText = () => t(
  '你好，我是搬家小助手 👋 试试「今日简报」，或说「帮 Tommy 加个任务：整理书桌 7/8 P2」「把姥姥所有 P2 推到 7/10」。',
  'Hi, I’m your moving assistant 👋 Try “today’s brief”, or say “add a task for Tommy: tidy the desk 7/8 P2” or “push all of Grandma’s P2 tasks to 7/10”.',
);

let seq = 0;
const uid = () => `m${(seq += 1).toString(36)}`;

interface Interaction {
  id: string;
  kind: 'ambiguous' | 'confirm';
  message: string;
  action: AssistantAction;
  candidates?: { id: string; title: string }[];
}
interface UIMsg extends ChatMessage {
  id: string;
  results?: { text: string; ok: boolean }[];
  interactions?: Interaction[];
}

type SpeechRec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};
function getSpeechRec(): SpeechRec | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = curLang() === 'en' ? 'en-US' : 'zh-CN'; r.continuous = false; r.interimResults = false;
  return r;
}

// Fold one action's result into an assistant message.
function integrate(msg: UIMsg, action: AssistantAction, r: ApplyResult): UIMsg {
  if (r.status === 'done') return { ...msg, results: [...(msg.results ?? []), { text: r.message, ok: true }] };
  if (r.status === 'error') return { ...msg, results: [...(msg.results ?? []), { text: r.message, ok: false }] };
  const it: Interaction = { id: uid(), kind: r.status, message: r.message, action, candidates: r.status === 'ambiguous' ? r.candidates : undefined };
  return { ...msg, interactions: [...(msg.interactions ?? []), it] };
}

export function Assistant({ store, isMobile = false }: { store: Store; isMobile?: boolean }) {
  // On mobile, lift the button and panel above the 60px bottom nav.
  const fabBottom = isMobile ? 76 : 20;
  const panelBottom = isMobile ? 140 : 84;
  const [open, setOpen] = useState(false);
  const { lang } = useI18n();
  const [messages, setMessages] = useState<UIMsg[]>([
    { id: GREETING_ID, role: 'assistant', content: greetingText() },
  ]);
  // Keep the opening greeting in sync with the language while it's still the only
  // message (an ongoing conversation is left untouched — chat history isn't retranslated).
  useEffect(() => {
    setMessages((prev) => (prev.length === 1 && prev[0].id === GREETING_ID ? [{ ...prev[0], content: greetingText() }] : prev));
  }, [lang]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [tts, setTts] = useState(false);
  const [showMem, setShowMem] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef(store); storeRef.current = store;
  const messagesRef = useRef(messages); messagesRef.current = messages;
  const speechAvailable = typeof window !== 'undefined' && !!getSpeechRec();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, loading]);

  const buildContext = (): AssistantContext => {
    const s = storeRef.current;
    const nameOf = (id: string) => s.members.find((m) => m.id === id)?.name ?? id;
    const total = s.tasks.length;
    const done = s.tasks.filter((t) => t.status === 'done').length;
    return {
      lang: curLang(),
      today: `${md(TODAY)} ${WEEK[TODAY]}`,
      person: nameOf(s.person),
      schedule: DATES.map((d) => ({ date: d, weekday: WEEK[d], stage: STAGE[d], goal: GOAL[d] })),
      members: s.members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
      tasks: s.tasks.map((t) => ({ title: t.title, owner: nameOf(t.owner), date: t.date, priority: t.priority, status: t.status, blocking: t.blocking })),
      utils: s.utils.map((u) => ({ name: u.name, provider: u.provider, type: u.type, status: u.status, note: u.note })),
      docs: s.docs.map((d) => ({ title: d.title, tag: d.tag, body: d.body })),
      memory: s.memory,
      progress: { total, done, pct: total ? Math.round((done / total) * 100) : 0, inProgress: s.tasks.filter((t) => t.status === 'in_progress').length, p0Remaining: s.tasks.filter((t) => t.priority === 'P0' && t.status !== 'done').length },
    };
  };

  const speak = (text: string) => {
    if (!tts || !text || typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = curLang() === 'en' ? 'en-US' : 'zh-CN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const history: UIMsg[] = [...messagesRef.current, { id: uid(), role: 'user', content: q }];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      const { reply, actions } = await askAssistant(
        history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        buildContext(),
      );
      let am: UIMsg = { id: uid(), role: 'assistant', content: reply };
      for (const action of actions ?? []) am = integrate(am, action, storeRef.current.applyAction(action));
      setMessages((prev) => [...prev, am]);
      speak(reply);
    } catch (e) {
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: t('连接失败：', 'Connection failed: ') + (e instanceof Error ? e.message : t('未知错误', 'unknown error')) + t('（AI 需要联网，本地 npm run dev 不启动后端）', ' (the AI needs the deployed backend; local npm run dev has no API)') }]);
    } finally {
      setLoading(false);
    }
  };

  // Disambiguation: user picked one candidate → re-issue the action pinned to its id.
  const pickCandidate = (msgId: string, itId: string, action: AssistantAction, candId: string) => {
    const r = storeRef.current.applyAction({ ...action, id: candId } as AssistantAction);
    setMessages((prev) => prev.map((m) => (m.id === msgId ? integrate({ ...m, interactions: (m.interactions ?? []).filter((i) => i.id !== itId) }, action, r) : m)));
  };
  // Confirmation for delete / bulk.
  const confirmAction = (msgId: string, itId: string, action: AssistantAction, yes: boolean) => {
    const r = yes ? storeRef.current.applyAction(action, true) : null;
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msgId) return m;
      const base: UIMsg = { ...m, interactions: (m.interactions ?? []).filter((i) => i.id !== itId) };
      return r ? integrate(base, action, r) : { ...base, results: [...(base.results ?? []), { text: t('已取消', 'Cancelled'), ok: false }] };
    }));
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const rec = getSpeechRec();
    if (!rec) return;
    recRef.current = rec;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join('');
      setInput(transcript);
      if (transcript.trim()) send(transcript); // auto-send after dictation
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const btnBox: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, border: `1px solid ${ACCENT}`, background: 'white', color: ACCENT, fontSize: 12.5, cursor: 'pointer', fontWeight: 500 };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('打开搬家小助手', 'Open moving assistant')}
        style={{ position: 'fixed', right: 20, bottom: fabBottom, zIndex: 40, width: 54, height: 54, borderRadius: '50%', border: 'none', cursor: 'pointer', background: ACCENT, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {open
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
      </button>

      {open && (
        <div style={{ position: 'fixed', right: 20, bottom: panelBottom, zIndex: 40, width: 'min(390px, calc(100vw - 32px))', height: `min(600px, calc(100vh - ${panelBottom + 76}px))`, background: 'white', border: '1px solid oklch(0.9 0.006 85)', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* header */}
          <div style={{ padding: '11px 14px', borderBottom: '1px solid oklch(0.93 0.006 85)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 13 }}>AI</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t('搬家小助手', 'Moving Assistant')}</div>
              <div style={{ fontSize: 10.5, color: 'oklch(0.55 0.01 60)' }}>{t('查询 · 增改任务 · 分工 · 服务', 'Ask · edit tasks · assign · utilities')}</div>
            </div>
            {store.canUndo && (
              <button onClick={() => store.undo()} title={t('撤销上一步', 'Undo last step')} style={{ ...btnBox, padding: '4px 9px' }}>↩ {t('撤销', 'Undo')}</button>
            )}
            <button onClick={() => setShowMem((v) => !v)} title={t('小助手的长期记忆', 'Assistant’s long-term memory')} aria-label={t('记忆', 'Memory')} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${showMem ? ACCENT : 'oklch(0.88 0.008 85)'}`, background: showMem ? 'oklch(0.95 0.05 165)' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, position: 'relative' }}>
              🧠{store.memory.length > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 999, background: ACCENT, color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{store.memory.length}</span>}
            </button>
            <button onClick={() => setTts((v) => !v)} title={tts ? t('关闭朗读', 'Turn off read-aloud') : t('开启语音朗读', 'Turn on read-aloud')} aria-label={t('语音朗读', 'Read aloud')} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${tts ? ACCENT : 'oklch(0.88 0.008 85)'}`, background: tts ? 'oklch(0.95 0.05 165)' : 'white', color: tts ? ACCENT : 'oklch(0.5 0.01 60)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" />{tts ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <path d="M22 9l-6 6M16 9l6 6" />}</svg>
            </button>
          </div>

          {/* memory panel */}
          {showMem && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid oklch(0.93 0.006 85)', background: 'oklch(0.98 0.01 165)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.4 0.05 165)' }}>🧠 {t('长期记忆', 'Long-term memory')}</span>
                {store.memory.length > 0 && <button onClick={() => store.clearMemory()} style={{ marginLeft: 'auto', fontSize: 11, color: 'oklch(0.5 0.12 30)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('清除全部', 'Clear all')}</button>}
              </div>
              {store.memory.length === 0
                ? <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 60)' }}>{t('还没有记住任何偏好。试试对它说「记住弟弟叫小宝」。', 'No preferences remembered yet. Try telling it “remember my brother is called Xiaobao”.')}</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{store.memory.map((m, i) => <div key={i} style={{ fontSize: 12.5, color: 'oklch(0.35 0.02 60)' }}>· {m}</div>)}</div>}
            </div>
          )}

          {/* messages */}
          <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'oklch(0.985 0.004 85)' }}>
            {messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.content && (
                  <div style={{ maxWidth: '88%', padding: '9px 12px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', background: m.role === 'user' ? ACCENT : 'white', color: m.role === 'user' ? '#fff' : 'oklch(0.26 0.012 60)', border: m.role === 'user' ? 'none' : '1px solid oklch(0.92 0.006 85)', borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'user' ? 12 : 3 }}>
                    {m.content}
                  </div>
                )}
                {m.results?.map((r, j) => (
                  <div key={j} style={{ marginTop: 5, fontSize: 12, color: r.ok ? 'oklch(0.45 0.1 150)' : 'oklch(0.5 0.12 30)', background: r.ok ? 'oklch(0.96 0.03 150)' : 'oklch(0.96 0.03 30)', border: `1px solid ${r.ok ? 'oklch(0.88 0.05 150)' : 'oklch(0.88 0.05 30)'}`, borderRadius: 8, padding: '4px 9px', alignSelf: 'flex-start', maxWidth: '92%' }}>
                    {r.ok ? '✓ ' : '· '}{r.text}
                  </div>
                ))}
                {m.interactions?.map((it) => (
                  <div key={it.id} style={{ marginTop: 6, alignSelf: 'flex-start', maxWidth: '94%', background: 'white', border: '1px solid oklch(0.9 0.02 60)', borderRadius: 10, padding: '9px 11px' }}>
                    <div style={{ fontSize: 12.5, color: 'oklch(0.4 0.03 60)', marginBottom: 7 }}>{it.message}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {it.kind === 'ambiguous'
                        ? it.candidates?.map((c) => <button key={c.id} onClick={() => pickCandidate(m.id, it.id, it.action, c.id)} style={btnBox}>{c.title}</button>)
                        : <>
                            <button onClick={() => confirmAction(m.id, it.id, it.action, true)} style={{ ...btnBox, background: ACCENT, color: '#fff' }}>{t('确定', 'Confirm')}</button>
                            <button onClick={() => confirmAction(m.id, it.id, it.action, false)} style={{ ...btnBox, border: '1px solid oklch(0.88 0.008 85)', color: 'oklch(0.45 0.01 60)' }}>{t('取消', 'Cancel')}</button>
                          </>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {loading && <div style={{ fontSize: 13, color: 'oklch(0.55 0.01 60)', padding: '2px 4px' }}>{t('小助手思考中…', 'Assistant is thinking…')}</div>}
          </div>

          {/* quick chips */}
          <div style={{ display: 'flex', gap: 6, padding: '8px 10px 0', flexWrap: 'wrap' }}>
            {[t('今日简报', 'Today’s brief'), t('我今天的任务', 'My tasks today'), t('有什么风险', 'Any risks?')].map((q) => (
              <button key={q} onClick={() => send(q)} disabled={loading} style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid oklch(0.88 0.008 85)', background: 'white', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', color: 'oklch(0.42 0.012 60)' }}>{q}</button>
            ))}
          </div>

          {/* input */}
          <div style={{ padding: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            {speechAvailable && (
              <button onClick={toggleMic} aria-label={t('语音输入', 'Voice input')} title={listening ? t('停止', 'Stop') : t('语音输入', 'Voice input')} style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', cursor: 'pointer', border: `1px solid ${listening ? 'oklch(0.6 0.16 25)' : 'oklch(0.88 0.008 85)'}`, background: listening ? 'oklch(0.96 0.06 25)' : 'white', color: listening ? 'oklch(0.55 0.18 25)' : 'oklch(0.42 0.012 60)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" /></svg>
              </button>
            )}
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(input); }} placeholder={listening ? t('正在聆听…', 'Listening…') : t('问问小助手…', 'Ask the assistant…')} style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: '1px solid oklch(0.88 0.008 85)', borderRadius: 10, fontSize: 13.5, background: 'white' }} />
            <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{ flex: 'none', padding: '9px 14px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>{t('发送', 'Send')}</button>
          </div>
        </div>
      )}
    </>
  );
}
