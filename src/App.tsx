import { useEffect, useRef, useState } from 'react';
import { useStore } from './hooks/useStore';
import { MembersProvider } from './hooks/useMembers';
import { useSync } from './hooks/useSync';
import { Assistant } from './components/Assistant';
import { SyncButton } from './components/SyncButton';
import { ACCENT } from './lib/ui';
import { t, useI18n, type Lang } from './lib/i18n';
import { weekLabel } from './data/moveData';
import { Dashboard } from './views/Dashboard';
import { Timeline } from './views/Timeline';
import { People } from './views/People';
import { Checklist } from './views/Checklist';
import { Utilities } from './views/Utilities';
import { Docs } from './views/Docs';
import { Overview } from './views/admin/Overview';
import { AdminTasks } from './views/admin/AdminTasks';
import { AdminUtils } from './views/admin/AdminUtils';
import { AdminPeople } from './views/admin/AdminPeople';
import { AdminDocs } from './views/admin/AdminDocs';

export type FrontPage = 'dashboard' | 'timeline' | 'people' | 'checklist' | 'utilities' | 'docs';
export type AdminPage = 'overview' | 'tasks' | 'utils' | 'people' | 'docs';

// [id, zh label, en label, uppercase code shown as the small eyebrow]
const FRONT_NAV: [FrontPage, string, string, string][] = [
  ['dashboard', '概览', 'Overview', 'DASHBOARD'],
  ['timeline', '时间线', 'Timeline', 'TIMELINE'],
  ['people', '家庭分工', 'My Tasks', 'PEOPLE'],
  ['checklist', '任务清单', 'Checklist', 'CHECKLIST'],
  ['utilities', '服务开通', 'Utilities', 'UTILITIES'],
  ['docs', '模板文件', 'Templates', 'DOCS'],
];
const ADMIN_NAV: [AdminPage, string, string, string][] = [
  ['overview', '数据总览', 'Overview', 'OVERVIEW'],
  ['tasks', '任务管理', 'Tasks', 'TASKS'],
  ['utils', '服务管理', 'Utilities', 'UTILITIES'],
  ['people', '成员管理', 'People', 'PEOPLE'],
  ['docs', '模板管理', 'Templates', 'DOCS'],
];

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const onR = () => setMobile(window.innerWidth < 900);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return mobile;
}

export default function App() {
  const store = useStore();
  const sync = useSync(store);
  const isMobile = useIsMobile();
  const { lang, setLang } = useI18n();
  const [view, setView] = useState<'front' | 'admin'>('front');
  const [fp, setFp] = useState<FrontPage>('dashboard');
  const [ap, setAp] = useState<AdminPage>('overview');
  const [checklistCat, setChecklistCat] = useState('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const isFront = view === 'front';
  const total = store.tasks.length;
  const done = store.tasks.filter((t) => t.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const goFront = (p: FrontPage, opts?: { cat?: string }) => {
    setView('front');
    setFp(p);
    if (p === 'checklist') setChecklistCat(opts?.cat ?? 'all');
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = store.importData(String(reader.result));
      alert(ok ? t('进度导入成功', 'Progress imported') : t('导入失败：文件格式不正确', 'Import failed: invalid file format'));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const navDefs = isFront ? FRONT_NAV : ADMIN_NAV;
  const current = isFront ? fp : ap;
  const setCurrent = (id: string) => (isFront ? setFp(id as FrontPage) : setAp(id as AdminPage));

  return (
    <MembersProvider members={store.members}>
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ===== TOP BAR ===== */}
      <header style={{ height: 60, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 12px' : '0 22px', borderBottom: '1px solid oklch(0.92 0.006 85)', background: 'oklch(0.99 0.004 85)', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 11, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 15 }}>M</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '.01em', whiteSpace: 'nowrap' }}>Move Guide</div>
            {!isMobile && <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 60)', whiteSpace: 'nowrap' }}>{t('家庭搬家执行指南', 'Family Moving Playbook')}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flex: 'none' }}>
          {isFront && !isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 88, height: 7, background: 'oklch(0.92 0.006 85)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'oklch(0.72 0.13 150)', borderRadius: 999, transition: 'width .4s' }} />
              </div>
              <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12.5, fontWeight: 600, color: 'oklch(0.4 0.012 60)' }}>{pct}%</span>
            </div>
          )}
          <LangToggle lang={lang} setLang={setLang} />
          <SyncButton sync={sync} />
          <div style={{ display: 'flex', background: 'oklch(0.94 0.006 85)', borderRadius: 10, padding: 3 }}>
            <SwitchBtn active={isFront} onClick={() => setView('front')}>{t('家庭端', 'Family')}</SwitchBtn>
            <SwitchBtn active={!isFront} onClick={() => setView('admin')}>{t('管理后台', 'Admin')}</SwitchBtn>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ===== SIDEBAR ===== */}
        {!isMobile && (
          <aside style={{ width: 224, flex: 'none', borderRight: '1px solid oklch(0.92 0.006 85)', background: 'oklch(0.99 0.004 85)', padding: '18px 13px', display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '.14em', color: 'oklch(0.66 0.01 60)', padding: '4px 12px 8px', fontWeight: 500 }}>{isFront ? t('家庭端', 'FAMILY') : t('管理后台', 'ADMIN')}</div>
            {navDefs.map(([id, zh, en, code]) => {
              const active = current === id;
              return (
                <button
                  key={id}
                  onClick={() => setCurrent(id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
                    padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: 14, transition: 'background .15s',
                    background: active ? ACCENT : 'transparent',
                    color: active ? '#fff' : 'oklch(0.42 0.012 60)',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{t(zh, en)}</span>
                  <span style={{ fontFamily: "'Space Grotesk'", fontSize: 10.5, opacity: 0.55, letterSpacing: '.05em' }}>{code}</span>
                </button>
              );
            })}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 12px 4px', borderTop: '1px solid oklch(0.93 0.006 85)' }}>
              <div style={{ fontSize: 11, color: 'oklch(0.62 0.01 60)', lineHeight: 1.6 }}>
                {t('目标搬家日', 'Target move day')}<br /><span style={{ fontFamily: "'Space Grotesk'", fontSize: 15, fontWeight: 600, color: 'oklch(0.35 0.012 60)' }}>7/9 {weekLabel('07-09')}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <FooterBtn onClick={store.exportData}>{t('导出进度', 'Export')}</FooterBtn>
                <FooterBtn onClick={() => fileRef.current?.click()}>{t('导入', 'Import')}</FooterBtn>
                <FooterBtn onClick={() => { if (confirm(t('确定重置为初始数据？当前进度将清空。', 'Reset to the initial data? Current progress will be cleared.'))) store.resetAll(); }}>{t('重置', 'Reset')}</FooterBtn>
              </div>
              {/* 站长入口: build a shareable plan to send a friend (only the owner sees this) */}
              <a href="/config" title={t('生成一份发给朋友的搬家计划', 'Make a moving plan to send a friend')} style={{ marginTop: 6, fontSize: 11, color: 'oklch(0.62 0.03 165)', textDecoration: 'none' }}>
                {t('＋ 生成朋友版链接', '＋ Make a friend’s plan')}
              </a>
            </div>
          </aside>
        )}

        {/* ===== MAIN ===== */}
        <main style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px 14px 82px' : '26px 30px' }}>
          <div style={{ maxWidth: 1060, margin: '0 auto' }}>
            {isFront && fp === 'dashboard' && <Dashboard store={store} go={goFront} />}
            {isFront && fp === 'timeline' && <Timeline store={store} />}
            {isFront && fp === 'people' && <People store={store} />}
            {isFront && fp === 'checklist' && <Checklist store={store} cat={checklistCat} setCat={setChecklistCat} />}
            {isFront && fp === 'utilities' && <Utilities store={store} />}
            {isFront && fp === 'docs' && <Docs store={store} />}
            {!isFront && ap === 'overview' && <Overview store={store} />}
            {!isFront && ap === 'tasks' && <AdminTasks store={store} />}
            {!isFront && ap === 'utils' && <AdminUtils store={store} />}
            {!isFront && ap === 'people' && <AdminPeople store={store} />}
            {!isFront && ap === 'docs' && <AdminDocs store={store} />}
          </div>
        </main>
      </div>

      {/* ===== BOTTOM NAV (mobile) ===== */}
      {isMobile && (
        <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 60, display: 'flex', background: 'oklch(0.99 0.004 85)', borderTop: '1px solid oklch(0.9 0.006 85)', zIndex: 20, boxShadow: '0 -2px 12px rgba(0,0,0,.05)' }}>
          {navDefs.map(([id, zh, en]) => {
            const active = current === id;
            return (
              <button
                key={id}
                onClick={() => setCurrent(id)}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  padding: '7px 2px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, lineHeight: 1.2,
                  borderTop: `3px solid ${active ? ACCENT : 'transparent'}`,
                  color: active ? ACCENT : 'oklch(0.52 0.012 60)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {t(zh, en)}
              </button>
            );
          })}
        </nav>
      )}

      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImportFile} style={{ display: 'none' }} />
      <Assistant store={store} isMobile={isMobile} />
    </div>
    </MembersProvider>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const opts: [Lang, string][] = [['zh', '中'], ['en', 'EN']];
  return (
    <div style={{ display: 'flex', background: 'oklch(0.94 0.006 85)', borderRadius: 9, padding: 3 }} role="group" aria-label="Language">
      {opts.map(([v, l]) => {
        const active = lang === v;
        return (
          <button
            key={v}
            onClick={() => setLang(v)}
            aria-pressed={active}
            style={{
              padding: '5px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, lineHeight: 1,
              background: active ? ACCENT : 'transparent',
              color: active ? '#fff' : 'oklch(0.45 0.01 60)',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function SwitchBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        background: active ? ACCENT : 'transparent',
        color: active ? '#fff' : 'oklch(0.45 0.01 60)',
      }}
    >
      {children}
    </button>
  );
}

function FooterBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid oklch(0.9 0.006 85)', background: 'white', fontSize: 11.5, cursor: 'pointer', color: 'oklch(0.42 0.012 60)' }}
    >
      {children}
    </button>
  );
}
