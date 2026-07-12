// One-off: send the "how to use the moving assistant" guide card to a single
// family member (default 爸爸). Guarded by CRON_SECRET so it can't be abused to
// spam. Call: GET /api/lark-guide?secret=...&user=<user_id>
import { sendCardToUser } from '../lib/lark.js';

const ROOM = process.env.LARK_SYNC_ROOM || '55VA8N';
// Link INTO the shared room so tapping lands on the synced board (not a local copy).
const APP_URL = `https://banjia-two.vercel.app/#room=${encodeURIComponent(ROOM)}`;

function guideCard() {
  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '📖 搬家小助手 · 使用说明 / How to use' }, template: 'green' },
    body: {
      elements: [
        { tag: 'markdown', content: '**① 在群里直接指挥它 / Just @ it in the group** 💬\n@搬家小助手 后面用大白话说就行，例如：\nJust @ the bot in plain language, e.g.:\n· `@搬家小助手 帮爸爸加个任务：明天上午去新房量沙发尺寸`\n· `@搬家小助手 把"修改USCIS地址"标记完成`\n· `@搬家小助手 把姥姥的打包任务改成P2`\n它会在群里回你一句确认。 / It replies with a quick confirmation.' },
        { tag: 'hr' },
        { tag: 'markdown', content: '**② 每天早上的简报 / Daily morning brief** ☀️\n自动发来当天重点，点卡片上的 **✅ 我来完成** 就能直接勾掉。\nA brief of the day’s key tasks arrives automatically — tap **✅ I’ll do it** on the card to check it off.' },
        { tag: 'hr' },
        { tag: 'markdown', content: `**③ 网页清单 / The web list** 🖥️\nbanjia-two.vercel.app（房间码 / room code **${ROOM}**）\n· 群里或别人改了什么，网页 **~4 秒**自动更新。 / Changes show on the web in ~4s, no manual refresh.\n· 右上角 🔄 旁的**小红点** = 小助手刚更新了清单（可在同步面板关掉）。 / A red dot by 🔄 means the assistant just updated the list (can be turned off).\n· 看到「有新版本 / New version」提示，点**刷新 / Refresh**。` },
        { tag: 'hr' },
        { tag: 'markdown', content: '**④ 中文 / English** 🌐\n网页右上角有 **中 / EN** 切换按钮，随时一键切换语言。\nUse the **中 / EN** toggle in the top-right corner to switch languages anytime.' },
        { tag: 'button', text: { tag: 'plain_text', content: '🔗 打开搬家清单 / Open the list' }, type: 'primary', behaviors: [{ type: 'open_url', default_url: APP_URL }] },
      ],
    },
  };
}

// A gentler, example-heavy walkthrough focused ONLY on the AI assistant — for a
// family member who finds it hard to use. Chinese-first for clarity, with copy-and-
// tweak examples and both ways to reach it (group @ and the web chat bubble).
function assistantGuideCard() {
  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '🤖 搬家小助手 · 妈妈专用说明' }, template: 'wathet' },
    body: {
      elements: [
        { tag: 'markdown', content: '小助手就是一个**能听懂大白话的帮手**：你想查什么、想改什么，直接用平常说话的方式告诉它就行，它会自动帮你改好、回你一句确认 ✅。有两种用法 👇' },
        { tag: 'hr' },
        { tag: 'markdown', content: '**用法一：在这个飞书群里叫它（最简单）** 💬\n在群里先打一个 **@**，选中那个叫 **Move Guide / 搬家小助手** 的机器人，然后接着用大白话说。\n下面这些可以**直接照抄**（改成你自己的话）：\n· `@搬家小助手 我今天要做什么？`\n· `@搬家小助手 我还有哪些没做完？`\n· `@搬家小助手 把"冰箱清空"标记完成`\n· `@搬家小助手 帮我加个任务：下午去超市买打包箱`\n发出去后，它就在群里回你。' },
        { tag: 'hr' },
        { tag: 'markdown', content: '**用法二：在网页里跟它聊（能语音）** 🗣️\n打开搬家清单网页，点**右下角绿色的对话气泡** 💬，就像发微信一样：\n· 想省事就点上面的快捷按钮「**今日简报**」，马上看到今天要做什么\n· 想说话就点那个**麦克风🎤图标**，直接说「我今天要做什么」，说完它自动发送\n· 也可以打字，比如打「把冰箱清空标记完成」' },
        { tag: 'hr' },
        { tag: 'markdown', content: '**它能帮你做这些**\n· 查 🔍：今天做什么、还剩哪些、谁负责什么\n· 改 ✏️：加任务、标记完成、改日期或负责人\n\n**放心用的小提示**\n· 记不住任务全名？说个大概词就行，比如「冰箱」\n· 说错了不要紧，再说一遍即可\n· 名字记不清就直接说「我的任务」' },
        { tag: 'button', text: { tag: 'plain_text', content: '🔗 打开网页找小助手（右下角💬）' }, type: 'primary', behaviors: [{ type: 'open_url', default_url: APP_URL }] },
      ],
    },
  };
}

export default async function handler(req, res) {
  const secret = req.query.secret || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const user = req.query.user || '783a2174'; // 爸爸
  const card = req.query.kind === 'assistant' ? assistantGuideCard() : guideCard();
  const result = await sendCardToUser(user, card);
  res.status(200).json({ user, kind: req.query.kind || 'general', ...result });
}
