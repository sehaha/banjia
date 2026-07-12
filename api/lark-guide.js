// One-off: send the "how to use the moving assistant" guide card to a single
// family member (default 爸爸). Guarded by CRON_SECRET so it can't be abused to
// spam. Call: GET /api/lark-guide?secret=...&user=<user_id>
import { sendCardToUser } from '../lib/lark.js';

const APP_URL = 'https://banjia-two.vercel.app/';
const ROOM = process.env.LARK_SYNC_ROOM || '55VA8N';

function guideCard() {
  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '📖 搬家小助手 · 使用说明' }, template: 'green' },
    body: {
      elements: [
        { tag: 'markdown', content: '**① 在群里直接指挥它** 💬\n@搬家小助手 后面用大白话说就行，例如：\n· `@搬家小助手 帮爸爸加个任务：明天上午去新房量沙发尺寸`\n· `@搬家小助手 把"修改USCIS地址"标记完成`\n· `@搬家小助手 把姥姥的打包任务改成P2`\n它会在群里回你一句确认。' },
        { tag: 'hr' },
        { tag: 'markdown', content: '**② 每天早上的简报** ☀️\n会自动发来当天要做的重点，点卡片上的 **✅ 我来完成** 就能直接勾掉。' },
        { tag: 'hr' },
        { tag: 'markdown', content: `**③ 网页清单** 🖥️\nbanjia-two.vercel.app（房间码 **${ROOM}**）\n· 群里或别人改了什么，网页 **~4 秒**自动更新，不用手动刷新\n· 右上角 🔄 旁出现**小红点** = 小助手刚更新了清单（嫌吵可在同步面板里关掉）\n· 看到「有新版本」提示，点 **刷新** 即可看到最新任务` },
        { tag: 'button', text: { tag: 'plain_text', content: '🔗 打开搬家清单' }, type: 'primary', behaviors: [{ type: 'open_url', default_url: APP_URL }] },
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
  const result = await sendCardToUser(user, guideCard());
  res.status(200).json({ user, ...result });
}
