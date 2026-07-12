import { useState } from 'react';
import { ACCENT } from '../lib/ui';
import {
  type MoveConfig, type MoveSize, type MoveTemplate,
  encodeConfig, DEFAULT_CONFIG, SIZE_LABEL, TEMPLATE_LABEL,
} from './toyData';

const field: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid oklch(0.86 0.008 85)', borderRadius: 10, fontSize: 15, background: 'white', boxSizing: 'border-box',
};
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'oklch(0.45 0.012 60)', marginBottom: 6, display: 'block' };

export default function ConfigView() {
  const [cfg, setCfg] = useState<MoveConfig>(() => ({ ...DEFAULT_CONFIG, name: '', from: '', to: '' }));
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof MoveConfig>(k: K, v: MoveConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const ready = cfg.name.trim() && cfg.from.trim() && cfg.to.trim() && cfg.date;
  const link = ready ? `${location.origin}/?d=${encodeConfig(cfg)}` : '';

  const copy = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'oklch(0.985 0.006 85)', color: 'oklch(0.24 0.012 60)' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 18px 48px' }}>
        <div style={{ fontFamily: "'Space Grotesk'", fontSize: 11, letterSpacing: '.16em', color: 'oklch(0.5 0.06 165)' }}>MAKE A PLAN</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 4px' }}>做一份送朋友的搬家计划</h1>
        <p style={{ fontSize: 13, color: 'oklch(0.5 0.01 60)', margin: '0 0 20px', lineHeight: 1.5 }}>
          你来填这几项，生成一个专属链接发给朋友，他点开就能看到写着自己名字的搬家计划。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label style={label}>朋友的名字</label>
            <input style={field} value={cfg.name} onChange={(e) => set('name', e.target.value)} placeholder="李雷" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>从哪里搬</label>
              <input style={field} value={cfg.from} onChange={(e) => set('from', e.target.value)} placeholder="上海 · 徐汇" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>搬到哪里</label>
              <input style={field} value={cfg.to} onChange={(e) => set('to', e.target.value)} placeholder="杭州 · 西湖" />
            </div>
          </div>
          <div>
            <label style={label}>搬家日期</label>
            <input style={field} type="date" value={cfg.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>户型</label>
              <select style={field} value={cfg.size} onChange={(e) => set('size', e.target.value as MoveSize)}>
                {(Object.keys(SIZE_LABEL) as MoveSize[]).map((s) => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>类型</label>
              <select style={field} value={cfg.template} onChange={(e) => set('template', e.target.value as MoveTemplate)}>
                {(Object.keys(TEMPLATE_LABEL) as MoveTemplate[]).map((tp) => <option key={tp} value={tp}>{TEMPLATE_LABEL[tp]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={label}>落款（你的名字，选填）</label>
            <input style={field} value={cfg.by ?? ''} onChange={(e) => set('by', e.target.value)} placeholder="一位老朋友" />
          </div>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: 'white', border: '1px solid oklch(0.9 0.006 85)', borderRadius: 14 }}>
          {ready ? (
            <>
              <div style={{ fontSize: 12, color: 'oklch(0.5 0.01 60)', marginBottom: 8 }}>专属链接已生成：</div>
              <div style={{ fontSize: 12.5, wordBreak: 'break-all', background: 'oklch(0.97 0.005 85)', borderRadius: 8, padding: '9px 11px', color: 'oklch(0.4 0.01 60)', lineHeight: 1.5 }}>{link}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={copy} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {copied ? '已复制 ✓' : '一键复制链接'}
                </button>
                <a href={link} target="_blank" rel="noreferrer" style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${ACCENT}`, background: 'white', color: ACCENT, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>预览</a>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'oklch(0.55 0.01 60)', textAlign: 'center', padding: '6px 0' }}>填好名字、起点、终点和日期，就会生成链接</div>
          )}
        </div>
      </div>
    </div>
  );
}
