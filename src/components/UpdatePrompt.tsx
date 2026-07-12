import { useRegisterSW } from 'virtual:pwa-register/react';
import { ACCENT, ACCENT_DARK } from '../lib/ui';
import { t, useI18n } from '../lib/i18n';

// Shown when the service worker has fetched a newer build. Because the app is a
// precaching PWA, a new deploy won't take effect until the SW activates + the page
// reloads — this banner lets the family do that with one tap instead of getting
// stuck on a stale version (which once hid bot-added tasks from the web).
export default function UpdatePrompt() {
  useI18n(); // re-render on language switch (this lives outside <App/>)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // Poll for a new version every 60s so long-open tabs surface the prompt
      // without needing a manual reload first.
      if (r) setInterval(() => { r.update().catch(() => {}); }, 60_000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
        display: 'flex', justifyContent: 'center', padding: '0 12px 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12,
          maxWidth: 440, width: '100%', padding: '11px 12px 11px 16px',
          background: 'oklch(0.99 0.004 85)', border: '1px solid oklch(0.9 0.006 85)',
          borderRadius: 14, boxShadow: '0 8px 28px oklch(0.3 0.02 60 / 0.16)',
        }}
      >
        <span style={{ fontSize: 13.5, color: 'oklch(0.35 0.012 60)', flex: 1, minWidth: 0 }}>
          🎉 {t('有新版本，刷新即可看到最新任务', 'New version available — refresh to see the latest')}
        </span>
        <button
          onClick={() => setNeedRefresh(false)}
          style={{
            flex: 'none', padding: '7px 10px', fontSize: 13, fontWeight: 500,
            color: 'oklch(0.5 0.01 60)', background: 'transparent', border: 'none',
            borderRadius: 9, cursor: 'pointer',
          }}
        >
          {t('稍后', 'Later')}
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{
            flex: 'none', padding: '7px 15px', fontSize: 13, fontWeight: 600,
            color: 'white', background: ACCENT, border: 'none', borderRadius: 9,
            cursor: 'pointer',
          }}
          onMouseDown={(e) => (e.currentTarget.style.background = ACCENT_DARK)}
          onMouseUp={(e) => (e.currentTarget.style.background = ACCENT)}
        >
          {t('刷新', 'Refresh')}
        </button>
      </div>
    </div>
  );
}
