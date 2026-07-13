import { useEffect, useMemo, useRef, useState } from 'react';
import { ACCENT } from '../lib/ui';
import {
  type MoveConfig, type ToyLang, computeTasks, daysUntilMove, estBoxes, progressKey,
  PHASE_ORDER, PHASE_EMOJI, type Phase, tt, planLang, phaseLabel, templateLabel, defaultWish,
} from './toyData';

function loadDone(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}

const CONFETTI = ['🎉', '🎊', '✨', '🎈', '🎁', '💛', '🌸', '⭐'];

function Celebration({ name, wish, by, lang, onClose }: { name: string; wish: string; by?: string; lang: ToyLang; onClose: () => void }) {
  const pieces = useMemo(
    () => Array.from({ length: 42 }, (_, i) => ({
      emoji: CONFETTI[i % CONFETTI.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      dur: 2.6 + Math.random() * 2.2,
      size: 16 + Math.random() * 16,
    })),
    [],
  );
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(20,26,22,.5)' }} onClick={onClose}>
      <style>{`
        @keyframes toyfall { 0%{ transform: translateY(-12vh) rotate(0); opacity:0 } 8%{opacity:1} 100%{ transform: translateY(112vh) rotate(360deg); opacity:1 } }
        @keyframes toypop { 0%{ transform: scale(.7); opacity:0 } 60%{ transform: scale(1.04) } 100%{ transform: scale(1); opacity:1 } }
      `}</style>
      {pieces.map((p, i) => (
        <span key={i} style={{ position: 'fixed', top: 0, left: `${p.left}%`, fontSize: p.size, animation: `toyfall ${p.dur}s linear ${p.delay}s infinite`, pointerEvents: 'none' }}>{p.emoji}</span>
      ))}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: 360, width: '100%', background: '#fff', borderRadius: 20, padding: '30px 24px 26px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.3)', animation: 'toypop .45s ease both' }}
      >
        <div style={{ fontSize: 52, lineHeight: 1 }}>🎁</div>
        <div style={{ fontSize: 21, fontWeight: 800, margin: '14px 0 4px', color: 'oklch(0.28 0.012 60)' }}>{tt(lang, `恭喜 ${name}，全部完成！`, `Congrats ${name}, all done!`)}</div>
        <div style={{ fontSize: 13, color: 'oklch(0.5 0.01 60)', marginBottom: 16 }}>{tt(lang, '清单上的每一项都搞定啦 🎉', 'Every task is checked off 🎉')}</div>
        <div style={{ fontSize: 14.5, lineHeight: 1.7, color: 'oklch(0.32 0.02 60)', background: 'oklch(0.97 0.02 150)', borderRadius: 14, padding: '14px 16px' }}>{wish}</div>
        {by && <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.03 165)', marginTop: 12 }}>{tt(lang, `—— 来自 ${by} 的祝福`, `— a wish from ${by}`)}</div>}
        <button onClick={onClose} style={{ marginTop: 20, padding: '11px 22px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{tt(lang, '收下祝福 🥳', 'Thanks! 🥳')}</button>
      </div>
    </div>
  );
}

function Check({ done }: { done: boolean }) {
  return (
    <span style={{
      width: 24, height: 24, flex: 'none', borderRadius: 7, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: '.15s', border: done ? '2px solid oklch(0.6 0.13 150)' : '2px solid oklch(0.82 0.01 80)', background: done ? 'oklch(0.6 0.13 150)' : 'white',
    }}>
      {done && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
    </span>
  );
}

export default function PlanView({ config, d }: { config: MoveConfig; d: string }) {
  const key = useMemo(() => progressKey(d), [d]);
  const tasks = useMemo(() => computeTasks(config), [config]);
  const [done, setDone] = useState<Set<string>>(() => loadDone(key));

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const lang = planLang(config);
  const total = tasks.length;
  const doneCount = tasks.filter((t) => done.has(t.id)).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const days = daysUntilMove(config);
  const countdown = days > 0
    ? tt(lang, `距离搬家还有 ${days} 天`, `${days} days until move day`)
    : days === 0
      ? tt(lang, '就是今天，搬家日！🎉', 'It’s moving day! 🎉')
      : tt(lang, `已搬家 ${-days} 天`, `${-days} days since the move`);

  useEffect(() => { document.title = tt(lang, `${config.name}的搬家计划`, `${config.name}’s Moving Plan`); }, [config.name, lang]);

  const complete = total > 0 && doneCount === total;
  const [celebrate, setCelebrate] = useState(false);
  const wasComplete = useRef(false);
  useEffect(() => {
    if (complete && !wasComplete.current) setCelebrate(true); // fire once, when it becomes complete
    wasComplete.current = complete;
  }, [complete]);
  const wish = (config.wish && config.wish.trim()) || defaultWish(lang);

  const byPhase = PHASE_ORDER
    .map((phase) => ({ phase, list: tasks.filter((t) => t.phase === phase) }))
    .filter((g) => g.list.length);

  return (
    <div style={{ minHeight: '100vh', background: 'oklch(0.985 0.006 85)', color: 'oklch(0.24 0.012 60)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 0 40px' }}>
        {/* Hero — name first (the "wow") */}
        <div style={{ background: '#26332C', color: '#fff', padding: '30px 22px 26px', borderRadius: '0 0 22px 22px' }}>
          <div style={{ fontFamily: "'Space Grotesk'", fontSize: 11, letterSpacing: '.16em', opacity: 0.5 }}>MOVE PLAN</div>
          <div style={{ fontSize: 27, fontWeight: 700, marginTop: 12, lineHeight: 1.2 }}>{tt(lang, `${config.name} 的搬家计划`, `${config.name}’s Moving Plan`)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10, fontSize: 15, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{config.from}</span>
            <span style={{ opacity: 0.5 }}>→</span>
            <span style={{ fontWeight: 600 }}>{config.to}</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, background: 'rgba(255,255,255,.12)', borderRadius: 999, padding: '8px 15px', fontSize: 14 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 600 }}>{countdown}</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.8, marginBottom: 7 }}>
              <span>{templateLabel(config.template, lang)} · {tt(lang, `约 ${estBoxes(config)} 个纸箱`, `~${estBoxes(config)} boxes`)}</span>
              <span style={{ fontFamily: "'Space Grotesk'" }}>{doneCount} / {total} · {pct}%</span>
            </div>
            <div style={{ height: 9, background: 'rgba(255,255,255,.15)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'oklch(0.72 0.13 150)', borderRadius: 999, transition: 'width .4s' }} />
            </div>
          </div>
        </div>

        {/* Persistent "all done" banner (re-open the celebration) */}
        {complete && (
          <button
            onClick={() => setCelebrate(true)}
            style={{ width: 'calc(100% - 28px)', margin: '16px 14px 0', padding: '13px 16px', borderRadius: 14, border: '1px solid oklch(0.85 0.06 150)', background: 'oklch(0.96 0.04 150)', color: 'oklch(0.4 0.12 150)', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
          >
            {tt(lang, '🎉 全部完成！点这里再看一次祝福 🎁', '🎉 All done! Tap to see your message again 🎁')}
          </button>
        )}

        {/* Phased task list */}
        <div style={{ padding: '20px 14px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {byPhase.map(({ phase, list }) => (
            <div key={phase}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.45 0.012 60)', margin: '2px 4px 10px', letterSpacing: '.02em' }}>
                {PHASE_EMOJI[phase as Phase]} {phaseLabel(phase as Phase, lang)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {list.map((t) => {
                  const isDone = done.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle(t.id)}
                      style={{
                        display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', width: '100%', cursor: 'pointer',
                        background: 'white', border: '1px solid oklch(0.92 0.006 85)', borderRadius: 12, padding: '13px 14px',
                      }}
                    >
                      <Check done={isDone} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 1.45, textDecoration: isDone ? 'line-through' : undefined, color: isDone ? 'oklch(0.68 0.01 60)' : 'oklch(0.26 0.012 60)' }}>
                        {t.title}
                      </span>
                      <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12, color: 'oklch(0.62 0.01 60)', flex: 'none', marginTop: 2 }}>{t.dateLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer signature */}
        <div style={{ textAlign: 'center', marginTop: 30, fontSize: 12.5, color: 'oklch(0.6 0.01 60)' }}>
          {config.by ? `Made with ♥ by ${config.by}` : 'Made with ♥'}
          <div style={{ marginTop: 6 }}>
            <a href="/config" style={{ color: 'oklch(0.55 0.06 165)', textDecoration: 'none', fontSize: 11.5 }}>{tt(lang, '也想做一份自己的？→', 'Want one of your own? →')}</a>
          </div>
        </div>
      </div>

      {celebrate && <Celebration name={config.name} wish={wish} by={config.by} lang={lang} onClose={() => setCelebrate(false)} />}
    </div>
  );
}
