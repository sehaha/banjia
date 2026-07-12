import type { Person, Task, Utility, DocTemplate, Priority, TaskStatus } from '../types';
import { curLang } from '../lib/i18n';

// ==== Calendar constants (7/5 ~ 7/11, move day = 7/9) ====
export const MOVE_DAY = '07-09';
export const DATES = ['07-05', '07-06', '07-07', '07-08', '07-09', '07-10', '07-11'];

// "Today" tracks the real date, clamped into the move window so the dashboard,
// countdown and 今日任务 reflect reality instead of a hardcoded 7/5.
export function currentDay(now: Date = new Date()): string {
  const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (DATES.includes(mmdd)) return mmdd;
  return mmdd < DATES[0] ? DATES[0] : DATES[DATES.length - 1];
}
export const TODAY = currentDay();

export const WEEK: Record<string, string> = {
  '07-05': '周日', '07-06': '周一', '07-07': '周二', '07-08': '周三',
  '07-09': '周四', '07-10': '周五', '07-11': '周六',
};

export const STAGE: Record<string, string> = {
  '07-05': '签约准备', '07-06': '新房交接', '07-07': '预约减量', '07-08': '最后打包',
  '07-09': '搬家日', '07-10': '关闭旧服务', '07-11': '补缺收尾',
};

export const GOAL: Record<string, string> = {
  '07-05': '签合同 · 确认规则 · 启动打包',
  '07-06': '新房交接 · 量尺寸 · 开通水电气网',
  '07-07': '定搬家公司 · 旧房减量',
  '07-08': '最后打包 · 旧房清理',
  '07-09': '搬家 · 下午退房交钥匙',
  '07-10': '关闭旧服务 · 退宽带设备',
  '07-11': '充电师傅 · 新房补缺',
};

export const CATEGORIES = [
  '合同与交接', '新房服务开通', '搬家公司', '家具尺寸与淘汰', '打包整理',
  '旧房退房', '宽带与设备', '地址修改', '邻居感谢卡', '搬家后收尾',
];

// ==== English labels for the fixed taxonomies (content data stays as authored) ====
const WEEK_EN: Record<string, string> = {
  '07-05': 'Sun', '07-06': 'Mon', '07-07': 'Tue', '07-08': 'Wed',
  '07-09': 'Thu', '07-10': 'Fri', '07-11': 'Sat',
};
const STAGE_EN: Record<string, string> = {
  '07-05': 'Sign & prep', '07-06': 'New-home handover', '07-07': 'Book movers & downsize',
  '07-08': 'Final packing', '07-09': 'Moving day', '07-10': 'Close old services', '07-11': 'Wrap-up',
};
const GOAL_EN: Record<string, string> = {
  '07-05': 'Sign lease · confirm rules · start packing',
  '07-06': 'Handover · measure · set up utilities',
  '07-07': 'Book movers · downsize old home',
  '07-08': 'Final packing · clean old home',
  '07-09': 'Move · check-out & hand back keys in PM',
  '07-10': 'Close old services · return modem',
  '07-11': 'EV charger · fill gaps at new home',
};
const CATEGORY_EN: Record<string, string> = {
  '合同与交接': 'Contract & handover',
  '新房服务开通': 'New-home utilities',
  '搬家公司': 'Moving company',
  '家具尺寸与淘汰': 'Furniture sizing & disposal',
  '打包整理': 'Packing',
  '旧房退房': 'Old-home move-out',
  '宽带与设备': 'Internet & equipment',
  '地址修改': 'Address changes',
  '邻居感谢卡': 'Neighbor thank-you cards',
  '搬家后收尾': 'Post-move wrap-up',
};

export const weekLabel = (d: string): string => (curLang() === 'en' ? WEEK_EN[d] ?? WEEK[d] : WEEK[d]);
export const stageLabel = (d: string): string => (curLang() === 'en' ? STAGE_EN[d] ?? STAGE[d] : STAGE[d]);
export const goalLabel = (d: string): string => (curLang() === 'en' ? GOAL_EN[d] ?? GOAL[d] : GOAL[d]);
export const catLabel = (c: string): string => (curLang() === 'en' ? CATEGORY_EN[c] ?? c : c);

export const PEOPLE: Person[] = [
  { id: 'dad', name: '爸爸', role: '总控 · 外部沟通', hue: 245 },
  { id: 'mom', name: '太太', role: '打包 · 生活恢复', hue: 8 },
  { id: 'tommy', name: 'Tommy', role: '房间 · 记录', hue: 65 },
  { id: 'kids', name: '弟弟', role: '物品 · 轻物', hue: 160 },
  { id: 'family', name: '全家', role: '共同任务', hue: 300 },
];

// Seed member list (members become editable at runtime via the store).
export const INITIAL_MEMBERS: Person[] = PEOPLE;

// Compact seed rows: [title, owner, date, category, priority, blocking, status, description]
type Row = [string, Task['owner'], string, string, Priority, boolean, TaskStatus, string];

const ROWS: Row[] = [
  ['签署租房合同', 'dad', '07-05', '合同与交接', 'P0', true, 'done', '确认租金、押金、租期、维修责任'],
  ['确认入住日期', 'dad', '07-05', '合同与交接', 'P0', false, 'done', ''],
  ['确认钥匙 / 车库遥控 / 邮箱钥匙', 'dad', '07-05', '合同与交接', 'P1', false, 'not_started', ''],
  ['确认 HOA / 门禁 / 停车规则', 'dad', '07-05', '合同与交接', 'P1', false, 'not_started', ''],
  ['确认水电气垃圾网络由谁开通', 'dad', '07-05', '新房服务开通', 'P1', false, 'in_progress', '租客 / 房东 / HOA'],
  ['明确 7/6 交接流程', 'dad', '07-05', '合同与交接', 'P1', false, 'not_started', ''],
  ['开始联系搬家公司', 'dad', '07-05', '搬家公司', 'P1', false, 'in_progress', '至少询价 3 家'],
  ['家庭初步打包', 'mom', '07-05', '打包整理', 'P2', false, 'in_progress', '先打不常用物品'],
  ['Tommy 开始写邻居感谢卡', 'tommy', '07-05', '邻居感谢卡', 'P2', false, 'not_started', '可用英文模板'],
  ['新房交接', 'dad', '07-06', '合同与交接', 'P0', true, 'not_started', ''],
  ['拍新房视频和照片', 'tommy', '07-06', '合同与交接', 'P0', false, 'not_started', '逐间录像存档'],
  ['记录所有已有损坏', 'dad', '07-06', '合同与交接', 'P1', false, 'not_started', '避免退押金纠纷'],
  ['量客厅尺寸', 'tommy', '07-06', '家具尺寸与淘汰', 'P1', false, 'not_started', ''],
  ['量卧室尺寸', 'tommy', '07-06', '家具尺寸与淘汰', 'P1', false, 'not_started', ''],
  ['量楼梯 / 走廊 / 门宽', 'tommy', '07-06', '家具尺寸与淘汰', 'P1', false, 'not_started', '确认大件能否进门'],
  ['统计家具数量', 'mom', '07-06', '家具尺寸与淘汰', 'P1', false, 'not_started', ''],
  ['确定哪些家具搬', 'mom', '07-06', '家具尺寸与淘汰', 'P1', false, 'not_started', '搬 / 卖 / 送 / 丢'],
  ['开通 SCE 电力', 'dad', '07-06', '新房服务开通', 'P0', true, 'not_started', '开始日设 7/8 或 7/9'],
  ['开通 IRWD 水 / 污水', 'dad', '07-06', '新房服务开通', 'P0', true, 'not_started', ''],
  ['开通 SoCalGas 天然气', 'dad', '07-06', '新房服务开通', 'P0', true, 'not_started', '需到场点火'],
  ['确认 WM 垃圾服务', 'dad', '07-06', '新房服务开通', 'P1', false, 'not_started', '是否已有桶 / 收垃圾日'],
  ['查询新房网络', 'dad', '07-06', '新房服务开通', 'P0', false, 'not_started', 'Fiber / Cox / AT&T / Spectrum'],
  ['确认 7/11 充电师傅', 'dad', '07-06', '新房服务开通', 'P2', false, 'in_progress', ''],
  ['确认搬家公司', 'dad', '07-07', '搬家公司', 'P0', true, 'not_started', ''],
  ['确认搬家公司计费方式', 'dad', '07-07', '搬家公司', 'P1', false, 'not_started', '时薪 / 最低时长 / 各项费用'],
  ['确认是否带毯子 / 推车 / 绑带', 'dad', '07-07', '搬家公司', 'P1', false, 'not_started', ''],
  ['处理旧家具：卖 / 送 / 丢', 'mom', '07-07', '家具尺寸与淘汰', 'P2', false, 'not_started', ''],
  ['开始改重要账单地址', 'dad', '07-07', '地址修改', 'P2', false, 'not_started', ''],
  ['旧宽带决定转移或取消', 'dad', '07-07', '宽带与设备', 'P1', false, 'not_started', ''],
  ['厨房打包 70%', 'mom', '07-07', '打包整理', 'P1', false, 'not_started', ''],
  ['孩子房间打包 80%', 'kids', '07-07', '打包整理', 'P1', false, 'not_started', ''],
  ['再次确认搬家公司时间', 'dad', '07-08', '搬家公司', 'P0', false, 'not_started', ''],
  ['再次确认水电气网', 'dad', '07-08', '新房服务开通', 'P0', false, 'not_started', ''],
  ['再次确认退房流程', 'dad', '07-08', '旧房退房', 'P1', false, 'not_started', ''],
  ['冰箱清空', 'mom', '07-08', '打包整理', 'P1', false, 'not_started', '提前解冻'],
  ['第一晚箱准备完成', 'mom', '07-08', '打包整理', 'P1', false, 'not_started', '洗漱 / 床品 / 充电器 / 药'],
  ['所有箱子标记房间', 'tommy', '07-08', '打包整理', 'P1', false, 'not_started', ''],
  ['Tommy 完成邻居感谢卡', 'tommy', '07-08', '邻居感谢卡', 'P2', false, 'not_started', ''],
  ['旧房初步清洁', 'mom', '07-08', '旧房退房', 'P2', false, 'not_started', ''],
  ['搬家前旧房拍照', 'dad', '07-09', '旧房退房', 'P0', false, 'not_started', ''],
  ['重要证件和贵重物品自己带', 'mom', '07-09', '打包整理', 'P0', false, 'not_started', '护照 / 现金 / 首饰'],
  ['搬家公司搬大件', 'family', '07-09', '搬家公司', 'P0', true, 'not_started', ''],
  ['新房床先装好', 'dad', '07-09', '搬家后收尾', 'P1', false, 'not_started', ''],
  ['新房 Wi-Fi 优先安装', 'dad', '07-09', '新房服务开通', 'P1', false, 'not_started', ''],
  ['第一晚箱打开', 'mom', '07-09', '搬家后收尾', 'P1', false, 'not_started', ''],
  ['旧房最后检查', 'mom', '07-09', '旧房退房', 'P1', false, 'not_started', '抽屉 / 床底 / 车库'],
  ['旧房退房视频', 'dad', '07-09', '旧房退房', 'P0', false, 'not_started', ''],
  ['交钥匙 / 遥控 / 邮箱钥匙', 'dad', '07-09', '旧房退房', 'P0', true, 'not_started', ''],
  ['与中介确认退房完成', 'dad', '07-09', '旧房退房', 'P0', false, 'not_started', ''],
  ['关闭旧房电水气', 'dad', '07-10', '宽带与设备', 'P1', false, 'not_started', '不早于退房清洁完成'],
  ['取消或转移旧宽带', 'dad', '07-10', '宽带与设备', 'P1', false, 'not_started', ''],
  ['退旧宽带设备', 'dad', '07-10', '宽带与设备', 'P0', false, 'not_started', '保留收据 / 追踪号'],
  ['保存退设备收据', 'dad', '07-10', '宽带与设备', 'P0', false, 'not_started', ''],
  ['检查新房服务账单', 'dad', '07-10', '新房服务开通', 'P2', false, 'not_started', ''],
  ['新房厨房整理', 'mom', '07-10', '搬家后收尾', 'P2', false, 'not_started', ''],
  ['新房卧室整理', 'mom', '07-10', '搬家后收尾', 'P2', false, 'not_started', ''],
  ['纸箱集中处理', 'kids', '07-10', '搬家后收尾', 'P2', false, 'not_started', ''],
  ['充电师傅上门', 'dad', '07-11', '新房服务开通', 'P2', false, 'not_started', ''],
  ['检查充电设备', 'dad', '07-11', '新房服务开通', 'P2', false, 'not_started', ''],
  ['统计新房缺少家具', 'mom', '07-11', '搬家后收尾', 'P2', false, 'not_started', ''],
  ['处理剩余旧家具', 'dad', '07-11', '家具尺寸与淘汰', 'P2', false, 'not_started', ''],
  ['家庭复盘未完成任务', 'family', '07-11', '搬家后收尾', 'P2', false, 'not_started', ''],
];

export const INITIAL_TASKS: Task[] = ROWS.map((r, i) => ({
  id: 'k' + i,
  title: r[0],
  owner: r[1],
  date: r[2],
  category: r[3],
  priority: r[4],
  blocking: r[5],
  status: r[6],
  description: r[7],
}));

export const INITIAL_UTILITIES: Utility[] = [
  { id: 'sce', type: 'new', name: 'SCE 电力', provider: 'Southern California Edison', address: '25 New Dawn', start: '7/9', status: 'not_started', note: '服务开始日设 7/8 或 7/9' },
  { id: 'irwd', type: 'new', name: 'IRWD 水 / 污水', provider: 'Irvine Ranch Water District', address: '25 New Dawn', start: '7/9', status: 'not_started', note: '与电同日开通' },
  { id: 'gas', type: 'new', name: 'SoCalGas 天然气', provider: 'Southern California Gas', address: '25 New Dawn', start: '7/9', status: 'not_started', note: '需到场点火确认' },
  { id: 'wm', type: 'new', name: '垃圾回收', provider: 'Waste Management of OC', address: '25 New Dawn', start: '待确认', status: 'not_started', note: '确认是否已有桶 / 收垃圾日 / 是否 HOA 负责' },
  { id: 'net', type: 'new', name: '网络宽带', provider: 'Fiber / Cox / AT&T / Spectrum', address: '25 New Dawn', start: '待预约', status: 'not_started', note: '先查地址可用运营商，再约安装' },
  { id: 'ev', type: 'new', name: '充电设备', provider: '电工师傅', address: '25 New Dawn', start: '7/11', status: 'in_progress', note: '转移充电卡头 / 检查充电位' },
  { id: 'oldnet', type: 'old', name: '旧宽带', provider: '现运营商', address: '17 Dava', start: '退设备', status: 'not_started', note: '保留退设备收据 / 追踪号 / 取消确认号' },
  { id: 'oldutil', type: 'old', name: '旧房水电气', provider: 'SCE / IRWD / SoCalGas', address: '17 Dava', start: '7/9晚–7/10', status: 'not_started', note: '不要早于退房清洁完成' },
];

export const INITIAL_DOCS: DocTemplate[] = [
  { id: 'd1', title: '搬家公司询价话术', tag: '英文', body: 'Hi, we are moving from 17 Dava to 25 New Dawn in Irvine on July 9. It is a local move. Could you please let me know your hourly rate, minimum hours, truck fee, travel fee, stairs fee, heavy item fee, and insurance coverage?' },
  { id: 'd2', title: '中介确认话术', tag: '英文', body: 'Hi, could you please confirm the key handover time and process for 25 New Dawn on July 6? We would also like to confirm the HOA rules, parking, and access codes.' },
  { id: 'd3', title: '退房确认话术', tag: '英文', body: 'Hi, we have completed the move-out cleaning at 17 Dava and returned the keys, garage remote, and mailbox key. Could you please confirm the move-out is complete and share the deposit return process?' },
  { id: 'd4', title: 'Tommy 邻居感谢卡', tag: '英文', body: 'Dear neighbor,\n\nThank you for being such a kind neighbor during our time here. We are moving to a new home, but we really appreciate all the friendliness and good memories from this neighborhood.\n\nWishing you and your family all the best.\n\nTommy and family' },
  { id: 'd5', title: '新房交接拍照清单', tag: '清单', body: '· 每个房间整体视频\n· 墙面 / 地板已有划痕\n· 厨房台面与电器\n· 卫生间水渍霉点\n· 门窗纱窗\n· 车库与储物\n· 水电气表读数' },
  { id: 'd6', title: '旧房退房拍照清单', tag: '清单', body: '· 清空后每个房间视频\n· 地毯 / 地板清洁后状态\n· 厨房与冰箱内部\n· 卫生间清洁状态\n· 墙面无遗留钉孔\n· 钥匙 / 遥控 / 邮箱钥匙合影\n· 水电气表最终读数' },
  { id: 'd7', title: '地址修改清单', tag: '清单', body: '· 银行 / 信用卡\n· 驾照 DMV\n· 报税与工资\n· 保险（车 / 医疗 / 房屋）\n· 学校与医生\n· 亚马逊 / 常用网购\n· USPS 邮件转寄' },
];

export function md(d: string): string {
  const [m, dd] = d.split('-');
  return +m + '/' + +dd;
}

export function personBy(id: string): Person {
  return PEOPLE.find((p) => p.id === id) || PEOPLE[0];
}
