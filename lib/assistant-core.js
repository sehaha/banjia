// Shared assistant brain used by both the web endpoint (/api/assistant) and the
// Lark group bot (/api/lark-event). Builds the system prompt + tool set and runs
// one Claude turn, returning { reply, actions }.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ASSISTANT_MODEL || 'claude-haiku-4-5';
const PRIORITY = ['P0', 'P1', 'P2'];
const STATUS = ['not_started', 'in_progress', 'done', 'issue'];

export const TOOLS = [
  { name: 'add_task', description: '新增一条任务。用户说“加/添加任务”“帮 X 记一件事”时调用。',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, owner: { type: 'string', description: '成员名或id' }, date: { type: 'string', description: 'MM-DD' }, priority: { type: 'string', enum: PRIORITY }, category: { type: 'string' } }, required: ['title'] } },
  { name: 'reassign', description: '把某条已有任务改派给另一个成员。',
    input_schema: { type: 'object', properties: { match: { type: 'string', description: '任务标题关键词' }, owner: { type: 'string', description: '新负责人（成员名或id）' } }, required: ['match', 'owner'] } },
  { name: 'set_status', description: '修改某条任务的状态（如标记完成/进行中/有问题）。',
    input_schema: { type: 'object', properties: { match: { type: 'string' }, status: { type: 'string', enum: STATUS } }, required: ['match', 'status'] } },
  { name: 'set_priority', description: '修改某条任务的优先级。',
    input_schema: { type: 'object', properties: { match: { type: 'string' }, priority: { type: 'string', enum: PRIORITY } }, required: ['match', 'priority'] } },
  { name: 'set_date', description: '修改某条任务的日期。',
    input_schema: { type: 'object', properties: { match: { type: 'string' }, date: { type: 'string', description: 'MM-DD' } }, required: ['match', 'date'] } },
  { name: 'set_blocking', description: '标记某条任务是否“阻塞搬家”。',
    input_schema: { type: 'object', properties: { match: { type: 'string' }, blocking: { type: 'boolean' } }, required: ['match', 'blocking'] } },
  { name: 'delete_task', description: '删除某条任务。',
    input_schema: { type: 'object', properties: { match: { type: 'string' } }, required: ['match'] } },
  { name: 'add_member', description: '添加一个家庭成员。',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } }, required: ['name'] } },
  { name: 'rename_member', description: '给某个成员改名。',
    input_schema: { type: 'object', properties: { match: { type: 'string', description: '现在的名字或id' }, name: { type: 'string', description: '新名字' } }, required: ['match', 'name'] } },
  { name: 'set_utility', description: '修改某项服务开通状态（水/电/气/网/垃圾/充电/旧宽带等）。',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: '服务名关键词' }, status: { type: 'string', enum: STATUS, description: 'not_started=未开通, in_progress=申请中, done=已确认, issue=有问题' } }, required: ['name', 'status'] } },
  { name: 'bulk_update', description: '批量修改符合条件的任务（如“把姥姥所有 P2 推到 7/10”）。filter 指定筛选条件，set 指定要改成什么。',
    input_schema: { type: 'object', properties: {
      filter: { type: 'object', properties: { owner: { type: 'string' }, priority: { type: 'string', enum: PRIORITY }, date: { type: 'string' }, category: { type: 'string' } } },
      set: { type: 'object', properties: { owner: { type: 'string' }, priority: { type: 'string', enum: PRIORITY }, status: { type: 'string', enum: STATUS }, date: { type: 'string' } } },
    }, required: ['filter', 'set'] } },
  { name: 'remember', description: '记住用户的一条长期偏好或事实，供以后跨会话使用（如“弟弟其实叫小宝”“垃圾由 HOA 负责”）。仅在用户明确要你记住时调用。',
    input_schema: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] } },
];

export function buildSystem(ctx) {
  const members = Array.isArray(ctx.members) ? ctx.members : [];
  const tasks = Array.isArray(ctx.tasks) ? ctx.tasks : [];
  const utils = Array.isArray(ctx.utils) ? ctx.utils : [];
  const docs = Array.isArray(ctx.docs) ? ctx.docs : [];
  const p = ctx.progress || {};
  const memberLines = members.map((m) => `- ${m.name}（id:${m.id}）${m.role ? ' · ' + m.role : ''}`).join('\n');
  const stageLines = Array.isArray(ctx.schedule) ? ctx.schedule.map((d) => `- ${d.date} ${d.weekday}：${d.stage}｜${d.goal}`).join('\n') : '';
  const taskLines = tasks.map((t) => `- [${t.status}] ${t.title} | 负责:${t.owner} | ${t.date} | ${t.priority}${t.blocking ? ' | 阻塞搬家' : ''}`).join('\n');
  const utilLines = utils.map((u) => `- ${u.name}（${u.type === 'new' ? '新房' : '旧房'}）状态:${u.status} | ${u.provider}${u.note ? ' | ' + u.note : ''}`).join('\n');
  const docLines = docs.map((d) => `- ${d.title}（${d.tag}）：${(d.body || '').replace(/\n/g, ' ').slice(0, 220)}`).join('\n');
  const memory = Array.isArray(ctx.memory) ? ctx.memory : [];
  const memLines = memory.map((m) => `- ${m}`).join('\n');

  return `你是「Move Guide」家庭搬家执行网页里的智能小助手，帮一家人协作完成从 17 Dava 搬到 25 New Dawn 的搬家（目标搬家日 7/9）。用简体中文、口语化、简洁地回答，先给结论。${ctx.channel === 'lark' ? '你现在在家庭飞书群里被 @ 到，回复要简短、群聊风格。' : ''}

【当前上下文】
- 今天：${ctx.today || ''}；当前使用者：${ctx.person || '未指定'}
- 整体进度：已完成 ${p.done ?? '?'}/${p.total ?? '?'}（${p.pct ?? '?'}%）；进行中 ${p.inProgress ?? '?'}；P0 未完成 ${p.p0Remaining ?? '?'}
- 家庭成员：
${memberLines || '（无）'}
- 每日阶段：
${stageLines || '（无）'}
- 全部任务（${tasks.length} 条）：
${taskLines || '（暂无）'}
- 服务开通：
${utilLines || '（无）'}
- 可复制模板：
${docLines || '（无）'}
- 长期记忆（用户偏好/事实，回答时要考虑）：
${memLines || '（暂无）'}

【通则】
- 搬家的人又累又焦虑：语气热情、沉稳、绝不废话；先给结论，短句、适度加粗关键项、少量 emoji（📦🚚📅👤✅⚠️）。
- 一句话含多个意图，就在**同一轮里连续调用多个工具**一次处理完再回复。
- 结合上文解析指代（“这个/那个/它”）：认出具体是哪条任务/哪个人，把完整任务标题填进 match。
- 需要改动一律**调用工具**，别把操作写进正文。owner 用成员名或 id；date 用 MM-DD（口语“7/8”即 07-08）；priority 只能 ${PRIORITY.join('/')}；status 只能 ${STATUS.join('/')}。

【四种场景】
🔍 查询：列**具体**任务标题/服务状态/模板名（配 [已完成]/[进行中]/[未开始] 标签）。找不到时主动引导（“没找到『X』，要不要我帮你新建？”）。
✍️ 增改：文字/日期/状态类改动**静默执行**——调用工具，成功后一句话确认。未说分类时按常识自动归类。
👥 分工：改派后带**分担感**——顺带说该成员当前几项；某人明显偏多时轻轻提醒是否分担。
🚚 服务/痛点：用户流露痛点时，推荐**已有模板话术**或**新建对应任务**，不假装能一键预约外部服务。

【其它】
- 粘贴的长文本/群消息：拆成**多条 add_task**（判断负责人/日期/优先级）。
- 长期偏好/事实：调用 remember。
- 被问“今天做什么/进度/风险”：结合 P0 未完成、临近 7/9 未开通的服务、阻塞、逾期、成员超载给重点提醒。`;
}

// One Claude turn → { reply, actions }.
export async function runAssistant(messages, context) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { reply: 'AI 小助手还没配置好（缺少 ANTHROPIC_API_KEY）。', actions: [] };
  const client = new Anthropic({ apiKey: key });
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystem(context),
      tools: TOOLS,
      messages: messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') })),
    });
    const reply = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const actions = resp.content.filter((b) => b.type === 'tool_use').map((b) => ({ type: b.name, ...b.input }));
    return { reply: reply || (actions.length ? '好的，帮你处理了。' : '好的。'), actions };
  } catch (e) {
    return { reply: '抱歉，AI 暂时无法回应（' + (e?.message || '未知错误') + '）。', actions: [] };
  }
}
