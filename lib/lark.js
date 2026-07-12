// Lark (飞书) integration via a self-built app: get a tenant_access_token,
// build an interactive brief card, and send it to each family member (by
// user_id) through the IM API. All secrets live in env only.

const DATES = ['07-05', '07-06', '07-07', '07-08', '07-09', '07-10', '07-11'];
const WEEK = { '07-05': '周日', '07-06': '周一', '07-07': '周二', '07-08': '周三', '07-09': '周四', '07-10': '周五', '07-11': '周六' };
const MOVE_DAY = '07-09';
const md = (d) => { const [m, dd] = d.split('-'); return +m + '/' + +dd; };

const DOMAIN = () => process.env.LARK_DOMAIN || 'open.larksuite.com';
const APP_ID = () => process.env.LARK_APP_ID || '';
const APP_SECRET = () => process.env.LARK_APP_SECRET || '';
// Comma-separated Lark user_ids to notify.
const userIds = () => (process.env.LARK_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

export function larkConfigured() {
  return !!(APP_ID() && APP_SECRET() && userIds().length);
}

export function currentDay(now = new Date()) {
  const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (DATES.includes(mmdd)) return mmdd;
  return mmdd < DATES[0] ? DATES[0] : DATES[DATES.length - 1];
}

export function summarize(board, today = currentDay()) {
  const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
  const members = Array.isArray(board?.members) ? board.members : [];
  const nameOf = (id) => members.find((m) => m.id === id)?.name || id;
  const daysToMove = Math.max(0, DATES.indexOf(MOVE_DAY) - DATES.indexOf(today));
  const p0 = tasks.filter((t) => t.priority === 'P0' && t.status !== 'done');
  const overdue = tasks.filter((t) => t.date < today && t.status !== 'done');
  const todayTasks = tasks.filter((t) => t.date === today);
  const groups = members
    .map((m) => {
      const list = todayTasks.filter((t) => t.owner === m.id);
      return { name: m.name, undone: list.filter((t) => t.status !== 'done').length, total: list.length };
    })
    .filter((g) => g.total > 0);
  return {
    today: md(today), weekday: WEEK[today] || '', daysToMove,
    p0: p0.slice(0, 6).map((t) => ({ id: t.id, title: t.title, owner: nameOf(t.owner), date: md(t.date) })),
    p0Count: p0.length, overdueCount: overdue.length, groups,
    total: tasks.length, done: tasks.filter((t) => t.status === 'done').length,
  };
}

// Map a Lark user_id to a display name (LARK_MEMBERS = JSON {user_id: name}).
export function larkMemberName(userId) {
  try {
    const map = JSON.parse(process.env.LARK_MEMBERS || '{}');
    return map[userId] || '家人';
  } catch {
    return '家人';
  }
}

// App link that JOINS the shared room (#room=CODE). Tapping a Lark card MUST land
// on the synced board — without the room code the app falls back to the device's
// own local copy, which still shows the original (mostly incomplete) seed data.
export function roomAppLink(appUrl, room) {
  const base = (appUrl || 'https://banjia-two.vercel.app/').replace(/\/+$/, '');
  return room ? `${base}/#room=${encodeURIComponent(room)}` : `${base}/`;
}

// Returns the interactive card *body* (config/header/elements) for the IM API.
// When `room` is given, each today-P0 gets a "✅ 我来完成" button that calls back.
export function buildBriefCard(s, appUrl, room) {
  const template = s.daysToMove <= 1 ? 'red' : s.overdueCount > 0 ? 'orange' : 'blue';
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const line1 = `**距搬家 ${s.daysToMove} 天** ｜ ✅ 进度 ${s.done}/${s.total}（${pct}%） ｜ ⚠️ P0 待办 **${s.p0Count}** ｜ ⏰ 逾期 **${s.overdueCount}**`;
  const groupBlock = s.groups.length ? '👥 **今日分工**\n' + s.groups.map((g) => `· ${g.name}：${g.undone}/${g.total} 未完成`).join('\n') : '';
  const link = appUrl || 'https://banjia-two.vercel.app/';
  const urlBtn = { tag: 'button', text: { tag: 'plain_text', content: '🔗 打开搬家清单' }, type: 'default', behaviors: [{ type: 'open_url', default_url: roomAppLink(appUrl, room) }] };
  const elements = [
    { tag: 'markdown', content: line1 },
    { tag: 'hr' },
  ];
  if (s.p0.length) {
    elements.push({ tag: 'markdown', content: '🔴 **今日必做（P0）**' });
    for (const t of s.p0) {
      elements.push({ tag: 'markdown', content: `· ${t.title}（${t.owner}·${t.date}）` });
      if (room && t.id) {
        // Deep-link "complete" button — a plain URL button (always works, no card
        // callback config). Opens a page that marks the task done + syncs the board.
        const doneUrl = `${link.replace(/\/+$/, '')}/api/complete?room=${encodeURIComponent(room)}&task=${encodeURIComponent(t.id)}&t=${encodeURIComponent(t.title)}`;
        elements.push({ tag: 'button', text: { tag: 'plain_text', content: '✅ 我来完成' }, type: 'primary', behaviors: [{ type: 'open_url', default_url: doneUrl }] });
      }
    }
  } else {
    elements.push({ tag: 'markdown', content: '🎉 P0 已全部完成' });
  }
  if (groupBlock) { elements.push({ tag: 'hr' }); elements.push({ tag: 'markdown', content: groupBlock }); }
  elements.push(urlBtn);
  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: `📦 今日搬家简报 · ${s.today} ${s.weekday}` }, template },
    body: { elements },
  };
}

// Card returned to Lark after a task is completed via a card button.
export function buildDoneCard(title, byName, appUrl, room) {
  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '✅ 任务已完成' }, template: 'green' },
    body: {
      elements: [
        { tag: 'markdown', content: `**${title}**\n\n已由 **${byName}** 于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' })} 标记完成 🎉` },
        { tag: 'button', text: { tag: 'plain_text', content: '🔗 打开搬家清单' }, type: 'default', behaviors: [{ type: 'open_url', default_url: roomAppLink(appUrl, room) }] },
      ],
    },
  };
}

export function buildAlertCard(title, content, appUrl, room) {
  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: `🔔 ${title}` }, template: 'red' },
    body: {
      elements: [
        { tag: 'markdown', content },
        { tag: 'button', text: { tag: 'plain_text', content: '🔗 打开搬家清单' }, type: 'default', behaviors: [{ type: 'open_url', default_url: roomAppLink(appUrl, room) }] },
      ],
    },
  };
}

async function tenantToken() {
  const r = await fetch(`https://${DOMAIN()}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID(), app_secret: APP_SECRET() }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error('token error: ' + j.msg);
  return j.tenant_access_token;
}

async function sendInteractiveToUser(token, userId, cardBody) {
  const r = await fetch(`https://${DOMAIN()}/open-apis/im/v1/messages?receive_id_type=user_id`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receive_id: userId, msg_type: 'interactive', content: JSON.stringify(cardBody) }),
  });
  const j = await r.json();
  return { userId, ok: j.code === 0, code: j.code, msg: j.msg };
}

// Send an interactive card to a single family member (by Lark user_id).
export async function sendCardToUser(userId, cardBody) {
  if (!larkConfigured()) return { configured: false };
  try {
    const token = await tenantToken();
    const r = await sendInteractiveToUser(token, userId, cardBody);
    return { configured: true, ...r };
  } catch (e) {
    return { configured: true, ok: false, error: e?.message || 'send failed' };
  }
}

// Send an interactive card to every configured family member.
export async function sendCardToAll(cardBody) {
  if (!larkConfigured()) return { configured: false };
  try {
    const token = await tenantToken();
    const results = [];
    for (const uid of userIds()) results.push(await sendInteractiveToUser(token, uid, cardBody));
    const sent = results.filter((r) => r.ok).length;
    return { configured: true, ok: sent > 0, sent, total: results.length, results };
  } catch (e) {
    return { configured: true, ok: false, error: e?.message || 'send failed' };
  }
}

// Read a synced board out of Upstash Redis (same store as /api/sync).
function redisCreds() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };
}
const roomKey = (room) => 'mg:' + String(room).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

export async function readRoomEnvelope(room) {
  const { url, token } = redisCreds();
  if (!url || !token || !room) return null;
  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(roomKey(room))}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    return j.result ? JSON.parse(j.result) : null;
  } catch {
    return null;
  }
}

export async function readRoomBoard(room) {
  const env = await readRoomEnvelope(room);
  return env?.data || null;
}

async function writeRoomEnvelope(room, envelope) {
  const { url, token } = redisCreds();
  if (!url || !token || !room) return false;
  try {
    const r = await fetch(`${url}/set/${encodeURIComponent(roomKey(room))}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(envelope),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function kvGet(key) {
  const { url, token } = redisCreds();
  if (!url || !token) return null;
  try { const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } }); return (await r.json()).result ?? null; } catch { return null; }
}
async function kvSet(key, val) {
  const { url, token } = redisCreds();
  if (!url || !token) return false;
  try { const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: String(val) }); return r.ok; } catch { return false; }
}
async function larkApi(path, method, token, bodyObj) {
  const r = await fetch(`https://${DOMAIN()}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: bodyObj ? JSON.stringify(bodyObj) : undefined });
  return r.json();
}

// Major move milestones → Lark calendar events (Pacific time).
const MILESTONES = [
  { key: 'sign', summary: '📝 签署租房合同', desc: '确认租金/押金/租期/维修责任', start: '2026-07-05T10:00:00-07:00', end: '2026-07-05T11:00:00-07:00' },
  { key: 'handover', summary: '🔑 新房交接（拍照·量尺寸）', desc: '逐间录像存档、记录已有损坏、量客厅/卧室/门宽', start: '2026-07-06T09:00:00-07:00', end: '2026-07-06T11:00:00-07:00' },
  { key: 'utilities', summary: '⚡ 开通水电气网（SCE/IRWD/SoCalGas）', desc: '开始日设 7/8 或 7/9；查新房网络运营商', start: '2026-07-06T13:00:00-07:00', end: '2026-07-06T14:00:00-07:00' },
  { key: 'mover', summary: '🚚 确认搬家公司', desc: '时间/计费方式/是否带毯子推车绑带', start: '2026-07-07T10:00:00-07:00', end: '2026-07-07T10:30:00-07:00' },
  { key: 'moveday', summary: '🚚 搬家日 · 搬家公司上门', desc: '贵重证件自己带；新房床/Wi-Fi 优先安装', start: '2026-07-09T09:00:00-07:00', end: '2026-07-09T13:00:00-07:00' },
  { key: 'checkout', summary: '🏠 旧房退房 · 拍视频交钥匙', desc: '最后检查抽屉/床底/车库；与中介确认退房', start: '2026-07-09T14:00:00-07:00', end: '2026-07-09T16:00:00-07:00' },
  { key: 'return-modem', summary: '📦 退宽带设备（留收据/追踪号）', desc: '取消或转移旧宽带；保存退设备收据', start: '2026-07-10T10:00:00-07:00', end: '2026-07-10T10:30:00-07:00' },
];

// Create the milestone events on an app-owned calendar with all family as attendees.
// Idempotent via a Redis flag; safe to trigger more than once.
export async function syncMilestones() {
  if (!larkConfigured()) return { configured: false };
  const token = await tenantToken();
  let calId = process.env.LARK_CALENDAR_ID || (await kvGet('mg:lark_cal_id'));
  if (!calId) {
    const j = await larkApi('/open-apis/calendar/v4/calendars', 'POST', token, { summary: '🏡 搬家 Move Guide', description: '17 Dava → 25 New Dawn 搬家关键节点', permissions: 'public' });
    if (j.code !== 0) return { ok: false, step: 'create_calendar', error: j.msg };
    calId = j.data.calendar.calendar_id;
    await kvSet('mg:lark_cal_id', calId);
  }
  if ((await kvGet('mg:lark_cal_done')) === '1') return { ok: true, already: true, calendarId: calId };
  const ids = (process.env.LARK_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const results = [];
  for (const m of MILESTONES) {
    const ev = await larkApi(`/open-apis/calendar/v4/calendars/${calId}/events`, 'POST', token, {
      summary: m.summary, description: m.desc,
      start_time: { timestamp: String(Math.floor(Date.parse(m.start) / 1000)) },
      end_time: { timestamp: String(Math.floor(Date.parse(m.end) / 1000)) },
      reminders: [{ minutes: 1440 }, { minutes: 60 }],
    });
    if (ev.code !== 0) { results.push({ key: m.key, ok: false, error: ev.msg }); continue; }
    const eventId = ev.data.event.event_id;
    let att = { code: 0 };
    if (ids.length) {
      att = await larkApi(`/open-apis/calendar/v4/calendars/${calId}/events/${eventId}/attendees?user_id_type=user_id`, 'POST', token, {
        attendees: ids.map((uid) => ({ type: 'user', user_id: uid })), need_notification: true,
      });
    }
    results.push({ key: m.key, ok: true, eventId, attendees: att.code === 0 ? 'ok' : 'err:' + att.msg });
  }
  if (results.length && results.every((r) => r.ok)) await kvSet('mg:lark_cal_done', '1');
  return { ok: results.every((r) => r.ok), calendarId: calId, results };
}

// Mark a task done in the room's shared board (so the web reflects it on next poll).
export async function completeTask(room, taskId) {
  const env = await readRoomEnvelope(room);
  const board = env?.data;
  if (!board || !Array.isArray(board.tasks)) return { ok: false, reason: 'no board' };
  const task = board.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, reason: 'task not found' };
  if (task.status === 'done') return { ok: true, task, already: true };
  const nextTasks = board.tasks.map((t) => (t.id === taskId ? { ...t, status: 'done' } : t));
  const nextEnv = {
    data: { ...board, tasks: nextTasks },
    rev: (env.rev || 0) + 1,
    updatedAt: Date.now(),
    origin: 'lark',
  };
  const ok = await writeRoomEnvelope(room, nextEnv);
  return { ok, task };
}

// ---------- Lark group bot: context + server-side action apply + chat reply ----------

const STAGE = { '07-05': '签约准备', '07-06': '新房交接', '07-07': '预约减量', '07-08': '最后打包', '07-09': '搬家日', '07-10': '关闭旧服务', '07-11': '补缺收尾' };
const GOAL = { '07-05': '签合同·确认规则·启动打包', '07-06': '新房交接·量尺寸·开通水电气网', '07-07': '定搬家公司·旧房减量', '07-08': '最后打包·旧房清理', '07-09': '搬家·下午退房交钥匙', '07-10': '关闭旧服务·退宽带设备', '07-11': '充电师傅·新房补缺' };
const CATEGORIES = ['合同与交接', '新房服务开通', '搬家公司', '家具尺寸与淘汰', '打包整理', '旧房退房', '宽带与设备', '地址修改', '邻居感谢卡', '搬家后收尾'];
const HUE_PALETTE = [245, 8, 65, 160, 300, 200, 40, 120, 280, 340, 90, 20];
let uidSeq = 0;
const uid = (p) => `${p}${Date.now().toString(36)}-${(uidSeq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
// Normalize a loose date ("7/8", "7-8", "07-08") into "MM-DD"; blank → move day.
function normalizeDate(d) {
  if (!d) return '07-09';
  const m = String(d).trim().match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
  if (!m) return '07-09';
  return `${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
}
const S_LABEL = { not_started: '未开始', in_progress: '进行中', done: '已完成', issue: '有问题' };
const U_LABEL = { not_started: '未开通', in_progress: '申请中', done: '已确认', issue: '有问题' };

// Build the assistant context object from a synced board.
export function boardContext(board, today = currentDay()) {
  const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
  const members = Array.isArray(board?.members) ? board.members : [];
  const nameOf = (id) => members.find((m) => m.id === id)?.name || id;
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  return {
    channel: 'lark',
    today: `${md(today)} ${WEEK[today] || ''}`,
    person: '家人',
    schedule: DATES.map((d) => ({ date: d, weekday: WEEK[d], stage: STAGE[d], goal: GOAL[d] })),
    members: members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    tasks: tasks.map((t) => ({ title: t.title, owner: nameOf(t.owner), date: t.date, priority: t.priority, status: t.status, blocking: t.blocking })),
    utils: (board?.utils || []).map((u) => ({ name: u.name, provider: u.provider, type: u.type, status: u.status, note: u.note })),
    docs: (board?.docs || []).map((d) => ({ title: d.title, tag: d.tag, body: d.body })),
    memory: board?.memory || [],
    progress: { total, done, pct: total ? Math.round((done / total) * 100) : 0, inProgress: tasks.filter((t) => t.status === 'in_progress').length, p0Remaining: tasks.filter((t) => t.priority === 'P0' && t.status !== 'done').length },
  };
}

function bOwnerId(board, x) {
  const fb = board.members.find((m) => m.id === 'family')?.id ?? board.members[0]?.id ?? 'family';
  if (!x) return fb;
  const q = String(x).trim().toLowerCase();
  const hit = board.members.find((m) => m.id.toLowerCase() === q || m.name.toLowerCase() === q);
  return hit ? hit.id : fb;
}
const bName = (board, id) => board.members.find((m) => m.id === id)?.name || id;

// Apply assistant actions to a board object (server-side, best-effort). Returns { board, results }.
export function applyActionsToBoard(input, actions) {
  const board = structuredClone(input); // deep copy so callers can diff against the original
  board.tasks ||= []; board.members ||= []; board.utils ||= []; board.memory ||= [];
  const results = [];
  const findTask = (match) => { const q = String(match || '').trim().toLowerCase(); return q ? board.tasks.find((t) => t.title.toLowerCase().includes(q)) : null; };
  for (const a of actions || []) {
    try {
      if (a.type === 'add_task') {
        const owner = bOwnerId(board, a.owner); const pri = a.priority || 'P1'; const title = String(a.title || '').trim();
        if (!title) { results.push('任务标题为空'); continue; }
        const nt = { id: uid('lk'), title, owner, date: normalizeDate(a.date), category: a.category && CATEGORIES.includes(a.category) ? a.category : CATEGORIES[0], priority: pri, blocking: pri === 'P0', status: 'not_started', description: '' };
        board.tasks.push(nt); results.push(`➕ 已加「${title}」→ ${bName(board, owner)}（${nt.date} ${pri}）`);
      } else if (a.type === 'set_status') {
        const t = findTask(a.match); if (!t) { results.push(`没找到「${a.match}」`); continue; }
        t.status = a.status; results.push(`${a.status === 'done' ? '✅' : '✏️'} 「${t.title}」→ ${S_LABEL[a.status] || a.status}`);
      } else if (a.type === 'reassign') {
        const t = findTask(a.match); if (!t) { results.push(`没找到「${a.match}」`); continue; }
        const owner = bOwnerId(board, a.owner); t.owner = owner; const cnt = board.tasks.filter((x) => x.owner === owner).length;
        results.push(`👤 「${t.title}」→ ${bName(board, owner)}（名下 ${cnt} 项）`);
      } else if (a.type === 'set_priority') {
        const t = findTask(a.match); if (!t) { results.push(`没找到「${a.match}」`); continue; }
        t.priority = a.priority; if (a.priority === 'P0') t.blocking = true; results.push(`「${t.title}」→ ${a.priority}`);
      } else if (a.type === 'set_date') {
        const t = findTask(a.match); if (!t) { results.push(`没找到「${a.match}」`); continue; }
        t.date = normalizeDate(a.date); results.push(`📅 「${t.title}」→ ${t.date}`);
      } else if (a.type === 'set_blocking') {
        const t = findTask(a.match); if (!t) { results.push(`没找到「${a.match}」`); continue; }
        t.blocking = !!a.blocking; results.push(`「${t.title}」${a.blocking ? '标记阻塞' : '取消阻塞'}`);
      } else if (a.type === 'delete_task') {
        const t = findTask(a.match); if (!t) { results.push(`没找到「${a.match}」`); continue; }
        board.tasks = board.tasks.filter((x) => x.id !== t.id); results.push(`🗑️ 已删除「${t.title}」`);
      } else if (a.type === 'add_member') {
        const n = String(a.name || '').trim(); if (!n) { results.push('成员名为空'); continue; }
        if (board.members.some((m) => m.name === n)) { results.push(`「${n}」已存在`); continue; }
        board.members.push({ id: uid('m'), name: n, role: a.role || '家庭成员', hue: HUE_PALETTE[board.members.length % HUE_PALETTE.length] }); results.push(`已添加成员「${n}」`);
      } else if (a.type === 'rename_member') {
        const q = String(a.match || '').trim().toLowerCase(); const m = board.members.find((x) => x.id.toLowerCase() === q || x.name.toLowerCase() === q);
        if (!m) { results.push(`没找到成员「${a.match}」`); continue; }
        const old = m.name; m.name = String(a.name || '').trim(); results.push(`「${old}」→「${m.name}」`);
      } else if (a.type === 'set_utility') {
        const q = String(a.name || '').trim().toLowerCase(); const u = board.utils.find((x) => x.name.toLowerCase().includes(q) || (x.provider || '').toLowerCase().includes(q));
        if (!u) { results.push(`没找到服务「${a.name}」`); continue; }
        u.status = a.status; results.push(`「${u.name}」→ ${U_LABEL[a.status] || a.status}`);
      } else if (a.type === 'bulk_update') {
        const f = a.filter || {}; const set = a.set || {};
        const fOwner = f.owner ? bOwnerId(board, f.owner) : null; const fDate = f.date ? normalizeDate(f.date) : null;
        const matched = board.tasks.filter((t) => (!fOwner || t.owner === fOwner) && (!f.priority || t.priority === f.priority) && (!fDate || t.date === fDate) && (!f.category || t.category === f.category));
        if (!matched.length) { results.push('没有符合条件的任务'); continue; }
        const setOwner = set.owner ? bOwnerId(board, set.owner) : null; const setDate = set.date ? normalizeDate(set.date) : null; const ids = new Set(matched.map((t) => t.id));
        board.tasks = board.tasks.map((t) => (ids.has(t.id) ? { ...t, ...(setOwner ? { owner: setOwner } : {}), ...(set.priority ? { priority: set.priority } : {}), ...(set.status ? { status: set.status } : {}), ...(setDate ? { date: setDate } : {}) } : t));
        results.push(`批量更新 ${matched.length} 条`);
      } else if (a.type === 'remember') {
        const note = String(a.note || '').trim(); if (note && !board.memory.includes(note)) { board.memory.push(note); results.push(`🧠 记住「${note}」`); }
      }
    } catch { results.push('操作出错'); }
  }
  return { board, results };
}

// Read a room, apply actions, write it back. Returns { results, changed }.
export async function applyActionsToRoom(room, actions) {
  const env = await readRoomEnvelope(room);
  const board = env?.data;
  if (!board || !Array.isArray(board.tasks)) return { results: [], changed: false, reason: 'no board' };
  const { board: next, results } = applyActionsToBoard(board, actions);
  const changed = JSON.stringify(next) !== JSON.stringify(board);
  if (changed) {
    await writeRoomEnvelope(room, { data: next, rev: (env.rev || 0) + 1, updatedAt: Date.now(), origin: 'lark' });
  }
  return { results, changed };
}

async function sendToChat(chatId, msgType, contentObj) {
  const token = await tenantToken();
  const r = await fetch(`https://${DOMAIN()}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receive_id: chatId, msg_type: msgType, content: JSON.stringify(contentObj) }),
  });
  return r.json();
}
export const sendTextToChat = (chatId, text) => sendToChat(chatId, 'text', { text });
export const sendCardToChat = (chatId, cardBody) => sendToChat(chatId, 'interactive', cardBody);

// Best-effort cross-instance event dedup (SET NX EX 600). Returns true if the
// event id was already processed — Lark re-delivers on any non-200/slow reply.
export async function seenEvent(id) {
  const { url, token } = redisCreds();
  if (!url || !token || !id) return false;
  const key = 'mg:evt:' + String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  try {
    const r = await fetch(`${url}/set/${encodeURIComponent(key)}/1/NX/EX/600`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    return j.result !== 'OK'; // null → key already existed → duplicate
  } catch { return false; }
}

// Which room a Lark chat maps to. Single-family app → one shared room.
export const larkRoom = () => process.env.LARK_SYNC_ROOM || process.env.LARK_ROOM || '';
