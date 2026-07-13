import { useState } from 'react';
import { ACCENT } from '../lib/ui';
import { t, useI18n, type Lang } from '../lib/i18n';
import {
  type MoveConfig, type MoveSize, type MoveTemplate,
  encodeConfig, DEFAULT_CONFIG, SIZES, TEMPLATES, sizeLabel, templateLabel,
} from './toyData';

const field: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid oklch(0.86 0.008 85)', borderRadius: 10, fontSize: 15, background: 'white', boxSizing: 'border-box',
};
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'oklch(0.45 0.012 60)', marginBottom: 6, display: 'block' };

export default function ConfigView() {
  const { lang, setLang } = useI18n(); // the builder UI language AND the plan's language
  const [cfg, setCfg] = useState<MoveConfig>(() => ({ ...DEFAULT_CONFIG, name: '', from: '', to: '' }));
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outLink, setOutLink] = useState('');
  const set = <K extends keyof MoveConfig>(k: K, v: MoveConfig[K]) => { setCfg((c) => ({ ...c, [k]: v })); setOutLink(''); setCopied(false); };

  const missing = [
    !cfg.name.trim() && t('名字', 'name'), !cfg.from.trim() && t('起点', 'from'),
    !cfg.to.trim() && t('终点', 'to'), !cfg.date && t('日期', 'date'),
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;

  const generate = async () => {
    setGenerated(true);
    if (!ready) { setOutLink(''); return; }
    setGenerating(true);
    const config: MoveConfig = { ...cfg, lang }; // stamp the plan's language
    let out = '';
    try {
      const res = await fetch('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) });
      const j = await res.json();
      if (j && j.code) out = `${location.origin}/?p=${j.code}`; // short, trustworthy link
    } catch { /* fall through to the offline link */ }
    if (!out) out = `${location.origin}/?d=${encodeConfig(config)}`; // fallback: self-contained link
    setOutLink(out);
    setGenerating(false);
  };

  const copy = () => {
    if (!outLink) return;
    navigator.clipboard?.writeText(outLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'oklch(0.985 0.006 85)', color: 'oklch(0.24 0.012 60)' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 18px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontFamily: "'Space Grotesk'", fontSize: 11, letterSpacing: '.16em', color: 'oklch(0.5 0.06 165)' }}>MAKE A PLAN</div>
          <div style={{ display: 'flex', background: 'oklch(0.94 0.006 85)', borderRadius: 9, padding: 3 }} role="group" aria-label="Language">
            {(['zh', 'en'] as [Lang, Lang]).map((v) => (
              <button key={v} onClick={() => { setLang(v); setOutLink(''); }} aria-pressed={lang === v}
                style={{ padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: lang === v ? ACCENT : 'transparent', color: lang === v ? '#fff' : 'oklch(0.45 0.01 60)' }}>
                {v === 'zh' ? '中' : 'EN'}
              </button>
            ))}
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 4px' }}>{t('做一份送朋友的搬家计划', 'Make a moving plan for a friend')}</h1>
        <p style={{ fontSize: 13, color: 'oklch(0.5 0.01 60)', margin: '0 0 20px', lineHeight: 1.5 }}>
          {t('你来填这几项，生成一个专属链接发给朋友，他点开就能看到写着自己名字的搬家计划。', 'Fill in a few details, generate a personal link, and send it to a friend — they’ll open a moving plan with their own name on it.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label style={label}>{t('朋友的名字', 'Friend’s name')}</label>
            <input style={field} value={cfg.name} onChange={(e) => set('name', e.target.value)} placeholder={t('李雷', 'Alex')} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>{t('从哪里搬', 'Moving from')}</label>
              <input style={field} value={cfg.from} onChange={(e) => set('from', e.target.value)} placeholder={t('上海 · 徐汇', 'San Francisco, CA')} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>{t('搬到哪里', 'Moving to')}</label>
              <input style={field} value={cfg.to} onChange={(e) => set('to', e.target.value)} placeholder={t('杭州 · 西湖', 'Seattle, WA')} />
            </div>
          </div>
          <div>
            <label style={label}>{t('搬家日期', 'Move date')}</label>
            <input style={field} type="date" value={cfg.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>{t('户型', 'Home size')}</label>
              <select style={field} value={cfg.size} onChange={(e) => set('size', e.target.value as MoveSize)}>
                {SIZES.map((s) => <option key={s} value={s}>{sizeLabel(s, lang)}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>{t('类型', 'Type')}</label>
              <select style={field} value={cfg.template} onChange={(e) => set('template', e.target.value as MoveTemplate)}>
                {TEMPLATES.map((tp) => <option key={tp} value={tp}>{templateLabel(tp, lang)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={label}>{t('落款（你的名字，选填）', 'Signature (your name, optional)')}</label>
            <input style={field} value={cfg.by ?? ''} onChange={(e) => set('by', e.target.value)} placeholder={t('一位老朋友', 'An old friend')} />
          </div>
          <div>
            <label style={label}>{t('祝福语（全部完成时撒花送上，选填）', 'Blessing (shown with confetti when all done, optional)')}</label>
            <textarea style={{ ...field, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} value={cfg.wish ?? ''} onChange={(e) => set('wish', e.target.value)}
              placeholder={t('乔迁之喜，愿你在新家一切顺利 🏡（留空则用默认祝福）', 'Wishing you a smooth move and a great new home 🏡 (blank = default)')} />
          </div>
        </div>

        <button
          onClick={generate}
          disabled={generating}
          style={{ marginTop: 24, width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 700, cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1 }}
        >
          {generating ? t('生成中…', 'Generating…') : t('生成链接', 'Generate link')}
        </button>

        {generated && !ready && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'oklch(0.5 0.12 40)', background: 'oklch(0.97 0.03 60)', border: '1px solid oklch(0.9 0.05 60)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            {t('还差：', 'Still needed: ')}{missing.join(t('、', ', '))}
          </div>
        )}

        {generated && ready && outLink && (
          <div style={{ marginTop: 14, padding: 16, background: 'white', border: '1px solid oklch(0.9 0.006 85)', borderRadius: 14 }}>
            <div style={{ fontSize: 12, color: 'oklch(0.5 0.01 60)', marginBottom: 8 }}>{t('专属链接已生成（可直接发微信）：', 'Your link is ready (safe to text or share):')}</div>
            <div style={{ fontSize: 13, wordBreak: 'break-all', background: 'oklch(0.97 0.005 85)', borderRadius: 8, padding: '9px 11px', color: 'oklch(0.4 0.01 60)', lineHeight: 1.5 }}>{outLink}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={copy} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {copied ? t('已复制 ✓', 'Copied ✓') : t('一键复制链接', 'Copy link')}
              </button>
              <a href={outLink} target="_blank" rel="noreferrer" style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${ACCENT}`, background: 'white', color: ACCENT, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>{t('预览', 'Preview')}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
