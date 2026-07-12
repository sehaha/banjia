import { useState } from 'react';
import type { Sync } from '../hooks/useSync';
import { ACCENT } from '../lib/ui';
import { t } from '../lib/i18n';

const DOT: Record<Sync['status'], string> = {
  off: 'oklch(0.75 0.01 60)',
  connecting: 'oklch(0.75 0.13 80)',
  synced: 'oklch(0.62 0.14 150)',
  error: 'oklch(0.6 0.18 28)',
  unconfigured: 'oklch(0.7 0.12 60)',
};
const label = (s: Sync['status']): string => ({
  off: t('未开启', 'Off'),
  connecting: t('连接中…', 'Connecting…'),
  synced: t('已同步', 'Synced'),
  error: t('连接出错', 'Error'),
  unconfigured: t('未配置', 'Not configured'),
}[s]);

export function SyncButton({ sync }: { sync: Sync }) {
  const [open, setOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!sync.roomLink) return;
    navigator.clipboard?.writeText(sync.roomLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const nudge = sync.botNudge.count;
  const nudgeText = sync.botNudge.titles.length
    ? t(`🤖 搬家助手加了：${sync.botNudge.titles.join('、')}`, `🤖 Assistant added: ${sync.botNudge.titles.join(', ')}`)
    : t('🤖 搬家助手更新了清单', '🤖 Assistant updated the list');

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen((o) => !o); sync.clearNudge(); }}
        title={nudge ? nudgeText : t('多人同步', 'Multi-device sync')}
        aria-label={nudge ? t(`多人同步，助手有 ${nudge} 项新更新`, `Multi-device sync, ${nudge} new assistant updates`) : t('多人同步', 'Multi-device sync')}
        style={{ position: 'relative', height: 30, padding: '0 9px', borderRadius: 8, border: '1px solid oklch(0.88 0.008 85)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[sync.enabled ? sync.status : 'off'] }} />
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="oklch(0.45 0.01 60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
        {nudge > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999, background: 'oklch(0.62 0.2 25)', color: 'white', fontSize: 10, fontWeight: 700, lineHeight: '15px', textAlign: 'center', boxShadow: '0 0 0 2px white' }}>
            {nudge > 9 ? '9+' : nudge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'absolute', right: 0, top: 38, zIndex: 61, width: 288, background: 'white', border: '1px solid oklch(0.9 0.006 85)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,.16)', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{t('多人同步', 'Multi-device sync')}</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'oklch(0.5 0.01 60)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[sync.enabled ? sync.status : 'off'] }} />
                {sync.enabled ? label(sync.status) : t('未开启', 'Off')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 60)', lineHeight: 1.5, marginBottom: 10 }}>
              {t('开启后，用同一个房间码的家人共享同一份清单，勾选、任务、成员实时同步。', 'Once on, family members using the same room code share one list — check-offs, tasks and members sync in real time.')}
            </div>

            {sync.status === 'unconfigured' && (
              <div style={{ fontSize: 12, color: 'oklch(0.5 0.12 40)', background: 'oklch(0.97 0.03 60)', border: '1px solid oklch(0.9 0.05 60)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                {t('同步服务尚未配置：需在 Vercel 项目里连接一个 Redis 存储（Upstash）。配置后即自动可用。', 'Sync isn’t configured yet: connect a Redis store (Upstash) to the Vercel project. It works automatically once set up.')}
              </div>
            )}

            {!sync.enabled ? (
              <>
                <button onClick={() => sync.start()} style={{ width: '100%', padding: '9px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('开启同步（生成房间）', 'Start sync (create a room)')}</button>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={t('加入已有房间码', 'Join an existing room code')} style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid oklch(0.88 0.008 85)', borderRadius: 8, fontSize: 13, letterSpacing: '.08em' }} />
                  <button onClick={() => joinCode.trim() && sync.start(joinCode.trim())} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACCENT}`, background: 'white', color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('加入', 'Join')}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'oklch(0.97 0.005 85)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'oklch(0.55 0.01 60)' }}>{t('房间码', 'Room code')}</span>
                  <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16, letterSpacing: '.12em', color: 'oklch(0.3 0.012 60)' }}>{sync.room}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={copy} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${ACCENT}`, background: copied ? 'oklch(0.95 0.05 150)' : 'white', color: ACCENT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{copied ? t('已复制邀请链接 ✓', 'Invite link copied ✓') : t('复制邀请链接', 'Copy invite link')}</button>
                  <button onClick={() => sync.stop()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid oklch(0.88 0.008 85)', background: 'white', color: 'oklch(0.5 0.12 30)', fontSize: 12.5, cursor: 'pointer' }}>{t('停止', 'Stop')}</button>
                </div>
                <div style={{ fontSize: 11.5, color: 'oklch(0.58 0.01 60)', marginTop: 8, lineHeight: 1.5 }}>
                  {t('把邀请链接发给家人，他们打开即自动加入本房间。', 'Send the invite link to family — opening it joins this room automatically.')}
                </div>
              </>
            )}

            <div
              onClick={() => sync.setNudgeEnabled(!sync.nudgeEnabled)}
              role="switch"
              aria-checked={sync.nudgeEnabled}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid oklch(0.94 0.006 85)', cursor: 'pointer', fontSize: 12, color: 'oklch(0.45 0.01 60)', userSelect: 'none' }}
            >
              <span style={{ flex: 1 }}>{t('🤖 助手更新时提示小红点', '🤖 Red dot on assistant updates')}</span>
              <span style={{ position: 'relative', width: 34, height: 20, borderRadius: 999, background: sync.nudgeEnabled ? ACCENT : 'oklch(0.85 0.008 85)', transition: 'background .2s', flex: 'none' }}>
                <span style={{ position: 'absolute', top: 2, left: sync.nudgeEnabled ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
