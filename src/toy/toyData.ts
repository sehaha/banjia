// ── Toy edition: a zero-backend, share-by-link personalized moving plan. ──
// The whole plan is encoded into the URL (?d=…). No database, no login, no sync.
// See 搬家助手-玩具版-PRD.md. This module is independent of the family app.

export type MoveSize = 'studio' | '1br' | '2br' | '3br';
export type MoveTemplate = 'local' | 'long';

export type ToyLang = 'zh' | 'en';
// Pick a string by the plan's language. The friend always sees the language the
// maker chose when building — independent of the friend's own device setting.
export const tt = (lang: ToyLang, zh: string, en: string): string => (lang === 'en' ? en : zh);
export const planLang = (cfg: MoveConfig): ToyLang => (cfg.lang === 'en' ? 'en' : 'zh');

export interface MoveConfig {
  name: string; // the friend's name — the "wow" hook on the first screen
  from: string; // e.g. "上海 · 徐汇" or "San Francisco, CA"
  to: string;
  date: string; // move day, ISO "YYYY-MM-DD"
  size: MoveSize;
  template: MoveTemplate;
  by?: string; // maker's signature (footer)
  wish?: string; // a personal blessing, shown in the finish-all celebration
  lang?: ToyLang; // language the plan renders in (set by the maker)
}

export const DEFAULT_CONFIG: MoveConfig = {
  name: '李雷', from: '上海 · 徐汇', to: '杭州 · 西湖',
  date: isoInDays(34), size: '2br', template: 'long', by: '一位老朋友', lang: 'zh',
};

export const SIZES: MoveSize[] = ['studio', '1br', '2br', '3br'];
export const TEMPLATES: MoveTemplate[] = ['local', 'long'];
export const sizeLabel = (s: MoveSize, lang: ToyLang): string => ({
  studio: tt(lang, '开间', 'Studio'), '1br': tt(lang, '一室', '1 bedroom'),
  '2br': tt(lang, '两室', '2 bedroom'), '3br': tt(lang, '三室及以上', '3+ bedroom'),
}[s]);
export const templateLabel = (t: MoveTemplate, lang: ToyLang): string =>
  (t === 'long' ? tt(lang, '跨城搬家', 'Long-distance move') : tt(lang, '同城搬家', 'Local move'));
// Size only tweaks a headline number (est. boxes), never the task set. (PRD §3)
export const SIZE_BOXES: Record<MoveSize, number> = { studio: 15, '1br': 25, '2br': 40, '3br': 60 };

export type Phase = '准备' | '打包' | '搬家日' | '收尾';
export const PHASE_ORDER: Phase[] = ['准备', '打包', '搬家日', '收尾'];
export const PHASE_EMOJI: Record<Phase, string> = { 准备: '📋', 打包: '📦', 搬家日: '🚚', 收尾: '🏡' };
const PHASE_EN: Record<Phase, string> = { 准备: 'Prep', 打包: 'Packing', 搬家日: 'Moving day', 收尾: 'Settling in' };
export const phaseLabel = (p: Phase, lang: ToyLang): string => (lang === 'en' ? PHASE_EN[p] : p);

interface TplItem { zh: string; en: string; offset: number; phase: Phase } // offset = days relative to move day

// Generic, anyone-applies rewrite of the family checklist. (PRD §3)
const LOCAL: TplItem[] = [
  { zh: '通知房东 / 确认退租日期', en: 'Notify landlord / confirm move-out date', offset: -30, phase: '准备' },
  { zh: '断舍离：清点不要的东西（卖 / 送 / 丢）', en: 'Declutter: sort what to sell / give away / toss', offset: -21, phase: '准备' },
  { zh: '预约搬家公司或租车（比价 2–3 家）', en: 'Book movers or a truck (compare 2–3 quotes)', offset: -14, phase: '准备' },
  { zh: '量新家门 / 电梯 / 走廊尺寸，确认大件能进', en: 'Measure new-home doors / elevator / hallways for big items', offset: -12, phase: '准备' },
  { zh: '备齐打包材料：纸箱 / 胶带 / 气泡膜 / 记号笔', en: 'Get packing supplies: boxes, tape, bubble wrap, markers', offset: -12, phase: '准备' },
  { zh: '开通新家水 / 电 / 燃气 / 网络', en: 'Set up utilities at the new home (power / water / gas / internet)', offset: -7, phase: '准备' },
  { zh: '办理地址变更（银行 / 快递 / 证件）', en: 'Change your address (bank / mail / IDs)', offset: -7, phase: '准备' },
  { zh: '开始打包不常用物品', en: 'Start packing things you rarely use', offset: -10, phase: '打包' },
  { zh: '打包厨房（保留最后几天要用的）', en: 'Pack the kitchen (keep what you need for the last few days)', offset: -3, phase: '打包' },
  { zh: '每个箱子标注房间 + 内容', en: 'Label every box with room + contents', offset: -2, phase: '打包' },
  { zh: '清空冰箱、提前解冻', en: 'Empty and defrost the fridge', offset: -1, phase: '打包' },
  { zh: '准备「第一晚必需品箱」（洗漱 / 床品 / 充电器 / 常用药）', en: 'Pack a first-night box (toiletries, bedding, chargers, meds)', offset: -1, phase: '打包' },
  { zh: '贵重物品和证件随身带，不上车', en: 'Carry valuables and documents with you, not on the truck', offset: -1, phase: '打包' },
  { zh: '搬家：家具大件搬运、清点上下车', en: 'Moving day: move big furniture, check items on/off the truck', offset: 0, phase: '搬家日' },
  { zh: '旧家最后检查（抽屉 / 床底 / 阳台）', en: 'Final sweep of the old place (drawers, under beds, balcony)', offset: 0, phase: '搬家日' },
  { zh: '拍旧家退租视频 / 照片，交钥匙', en: 'Photo/video the old place for move-out, hand back keys', offset: 0, phase: '搬家日' },
  { zh: '新家先装好床、找出必需品箱', en: 'Set up the bed first, find the first-night box', offset: 0, phase: '搬家日' },
  { zh: '关闭旧家水 / 电 / 燃气 / 网络', en: 'Shut off utilities at the old home', offset: 1, phase: '收尾' },
  { zh: '确认新家 Wi-Fi / 网络可用', en: 'Confirm Wi-Fi / internet works at the new home', offset: 1, phase: '收尾' },
  { zh: '逐间拆箱整理', en: 'Unpack room by room', offset: 3, phase: '收尾' },
  { zh: '处理搬家纸箱（回收 / 转卖）', en: 'Deal with the moving boxes (recycle / resell)', offset: 5, phase: '收尾' },
];

// Long-distance adds logistics / lodging / relocation items on top of local.
const LONG_EXTRA: TplItem[] = [
  { zh: '预约长途物流 / 托运，确认时效与保价', en: 'Book long-distance movers/freight; confirm timing & insurance', offset: -20, phase: '准备' },
  { zh: '安排搬家当天 / 途中的临时住宿', en: 'Arrange lodging for moving day / en route', offset: -14, phase: '准备' },
  { zh: '宠物 / 绿植的长途运输安排', en: 'Plan long-distance transport for pets / plants', offset: -12, phase: '准备' },
  { zh: '车辆 / 驾照 / 社保等跨城迁移与地址变更', en: 'Update vehicle / driver’s license / records for the new area', offset: -7, phase: '准备' },
  { zh: '打包「路上随身包」（换洗衣物 / 证件 / 充电宝）', en: 'Pack a travel bag (clothes, documents, power bank)', offset: -2, phase: '打包' },
  { zh: '到新城市后办理落地事项（居住登记等）', en: 'Handle arrival tasks in the new city (registration, etc.)', offset: 2, phase: '收尾' },
];

export interface PlanTask { id: string; title: string; date: Date; dateLabel: string; phase: Phase }

function isoInDays(days: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(iso: string): Date { const d = new Date(iso + 'T00:00:00'); return isNaN(d.getTime()) ? new Date() : d; }
function addDays(base: Date, days: number): Date { const d = new Date(base); d.setDate(d.getDate() + days); return d; }
const fmtDate = (d: Date, lang: ToyLang): string =>
  (lang === 'en' ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `${d.getMonth() + 1}月${d.getDate()}日`);

export function computeTasks(cfg: MoveConfig): PlanTask[] {
  const lang = planLang(cfg);
  const items = cfg.template === 'long' ? [...LOCAL, ...LONG_EXTRA] : LOCAL;
  const move = parseISO(cfg.date);
  return items
    .map((it, i) => { const date = addDays(move, it.offset); return { id: `t${i}`, title: lang === 'en' ? it.en : it.zh, date, dateLabel: fmtDate(date, lang), phase: it.phase }; })
    .sort((a, b) => a.date.getTime() - b.date.getTime() || PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
}

export function daysUntilMove(cfg: MoveConfig): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((parseISO(cfg.date).getTime() - today.getTime()) / 86400000);
}
export const estBoxes = (cfg: MoveConfig): number => SIZE_BOXES[cfg.size] ?? 30;
export const defaultWish = (lang: ToyLang): string => tt(
  lang,
  '乔迁之喜，万事顺遂！愿你在新家开启一段温暖又顺利的新生活 🏡✨',
  'Congrats on the new place! Wishing you a smooth move and a warm, happy new chapter 🏡✨',
);

// ── URL codec (fallback for the offline ?d= link). URL-safe base64 of the raw
// UTF-8 bytes — ~3x shorter than %-escaping for Chinese. Primary sharing now uses
// the short ?p=CODE link (api/plan.js); this stays as a no-backend fallback. ──
export function encodeConfig(cfg: MoveConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // URL-safe (+ becomes space in queries)
}
export function decodeConfig(d: string): MoveConfig | null {
  try {
    const b64 = d.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (d.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const cfg = JSON.parse(new TextDecoder().decode(bytes));
    if (cfg && typeof cfg.name === 'string' && typeof cfg.date === 'string') return cfg as MoveConfig;
    return null;
  } catch { return null; }
}

// Stable per-plan localStorage key so a friend's check-offs persist on their device.
export function progressKey(d: string): string {
  let h = 5381;
  for (let i = 0; i < d.length; i++) h = ((h << 5) + h + d.charCodeAt(i)) | 0;
  return 'toy_progress_' + (h >>> 0).toString(36);
}
