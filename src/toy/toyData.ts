// ── Toy edition: a zero-backend, share-by-link personalized moving plan. ──
// The whole plan is encoded into the URL (?d=…). No database, no login, no sync.
// See 搬家助手-玩具版-PRD.md. This module is independent of the family app.

export type MoveSize = 'studio' | '1br' | '2br' | '3br';
export type MoveTemplate = 'local' | 'long';

export interface MoveConfig {
  name: string; // the friend's name — the "wow" hook on the first screen
  from: string; // e.g. "上海 · 徐汇"
  to: string; // e.g. "杭州 · 西湖"
  date: string; // move day, ISO "YYYY-MM-DD"
  size: MoveSize;
  template: MoveTemplate;
  by?: string; // maker's signature (footer)
}

export const DEFAULT_CONFIG: MoveConfig = {
  name: '李雷', from: '上海 · 徐汇', to: '杭州 · 西湖',
  date: isoInDays(34), size: '2br', template: 'long', by: '一位老朋友',
};

export const SIZE_LABEL: Record<MoveSize, string> = {
  studio: '开间 / Studio', '1br': '一室', '2br': '两室', '3br': '三室及以上',
};
// Size only tweaks a headline number (est. boxes), never the task set. (PRD §3)
export const SIZE_BOXES: Record<MoveSize, number> = { studio: 15, '1br': 25, '2br': 40, '3br': 60 };

export const TEMPLATE_LABEL: Record<MoveTemplate, string> = { local: '同城搬家', long: '跨城搬家' };

export type Phase = '准备' | '打包' | '搬家日' | '收尾';
export const PHASE_ORDER: Phase[] = ['准备', '打包', '搬家日', '收尾'];
export const PHASE_EMOJI: Record<Phase, string> = { 准备: '📋', 打包: '📦', 搬家日: '🚚', 收尾: '🏡' };

interface TplItem { title: string; offset: number; phase: Phase } // offset = days relative to move day

// Generic, anyone-applies rewrite of the family checklist. (PRD §3)
const LOCAL: TplItem[] = [
  { title: '通知房东 / 确认退租日期', offset: -30, phase: '准备' },
  { title: '断舍离：清点不要的东西（卖 / 送 / 丢）', offset: -21, phase: '准备' },
  { title: '预约搬家公司或租车（比价 2–3 家）', offset: -14, phase: '准备' },
  { title: '量新家门 / 电梯 / 走廊尺寸，确认大件能进', offset: -12, phase: '准备' },
  { title: '备齐打包材料：纸箱 / 胶带 / 气泡膜 / 记号笔', offset: -12, phase: '准备' },
  { title: '开通新家水 / 电 / 燃气 / 网络', offset: -7, phase: '准备' },
  { title: '办理地址变更（银行 / 快递 / 证件）', offset: -7, phase: '准备' },
  { title: '开始打包不常用物品', offset: -10, phase: '打包' },
  { title: '打包厨房（保留最后几天要用的）', offset: -3, phase: '打包' },
  { title: '每个箱子标注房间 + 内容', offset: -2, phase: '打包' },
  { title: '清空冰箱、提前解冻', offset: -1, phase: '打包' },
  { title: '准备「第一晚必需品箱」（洗漱 / 床品 / 充电器 / 常用药）', offset: -1, phase: '打包' },
  { title: '贵重物品和证件随身带，不上车', offset: -1, phase: '打包' },
  { title: '搬家：家具大件搬运、清点上下车', offset: 0, phase: '搬家日' },
  { title: '旧家最后检查（抽屉 / 床底 / 阳台）', offset: 0, phase: '搬家日' },
  { title: '拍旧家退租视频 / 照片，交钥匙', offset: 0, phase: '搬家日' },
  { title: '新家先装好床、找出必需品箱', offset: 0, phase: '搬家日' },
  { title: '关闭旧家水 / 电 / 燃气 / 网络', offset: 1, phase: '收尾' },
  { title: '确认新家 Wi-Fi / 网络可用', offset: 1, phase: '收尾' },
  { title: '逐间拆箱整理', offset: 3, phase: '收尾' },
  { title: '处理搬家纸箱（回收 / 转卖）', offset: 5, phase: '收尾' },
];

// Long-distance adds logistics / lodging / relocation items on top of local.
const LONG_EXTRA: TplItem[] = [
  { title: '预约长途物流 / 托运，确认时效与保价', offset: -20, phase: '准备' },
  { title: '安排搬家当天 / 途中的临时住宿', offset: -14, phase: '准备' },
  { title: '宠物 / 绿植的长途运输安排', offset: -12, phase: '准备' },
  { title: '车辆 / 驾照 / 社保等跨城迁移与地址变更', offset: -7, phase: '准备' },
  { title: '打包「路上随身包」（换洗衣物 / 证件 / 充电宝）', offset: -2, phase: '打包' },
  { title: '到新城市后办理落地事项（居住登记等）', offset: 2, phase: '收尾' },
];

export interface PlanTask { id: string; title: string; date: Date; dateLabel: string; phase: Phase }

function isoInDays(days: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(iso: string): Date { const d = new Date(iso + 'T00:00:00'); return isNaN(d.getTime()) ? new Date() : d; }
function addDays(base: Date, days: number): Date { const d = new Date(base); d.setDate(d.getDate() + days); return d; }
const fmtDate = (d: Date): string => `${d.getMonth() + 1}月${d.getDate()}日`;

export function computeTasks(cfg: MoveConfig): PlanTask[] {
  const items = cfg.template === 'long' ? [...LOCAL, ...LONG_EXTRA] : LOCAL;
  const move = parseISO(cfg.date);
  return items
    .map((it, i) => { const date = addDays(move, it.offset); return { id: `t${i}`, title: it.title, date, dateLabel: fmtDate(date), phase: it.phase }; })
    .sort((a, b) => a.date.getTime() - b.date.getTime() || PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
}

export function daysUntilMove(cfg: MoveConfig): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((parseISO(cfg.date).getTime() - today.getTime()) / 86400000);
}
export const estBoxes = (cfg: MoveConfig): number => SIZE_BOXES[cfg.size] ?? 30;

// ── URL codec: URL-safe base64 of the UTF-8 JSON (handles Chinese). ──
export function encodeConfig(cfg: MoveConfig): string {
  const b64 = btoa(encodeURIComponent(JSON.stringify(cfg)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // URL-safe (+ becomes space in queries)
}
export function decodeConfig(d: string): MoveConfig | null {
  try {
    const b64 = d.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (d.length % 4)) % 4);
    const cfg = JSON.parse(decodeURIComponent(atob(b64)));
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
