// Deep-link task completion: the Lark card's "✅ 我来完成" button opens this URL.
// Plain URL buttons always work (no card-callback config needed). We mark the
// task done in the synced room (web reflects in ≤4s) and show a confirmation page.
import { completeTask } from '../lib/lark.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function handler(req, res) {
  const room = req.query.room;
  const task = req.query.task;
  const title = decodeURIComponent(req.query.t || '任务');
  let ok = false;
  let already = false;
  if (room && task) {
    try { const r = await completeTask(room, task); ok = !!r.ok; already = !!r.already; } catch { /* ok stays false */ }
  }
  // Link back INTO the shared room so the family lands on the synced board.
  const app = room ? `https://banjia-two.vercel.app/#room=${encodeURIComponent(room)}` : 'https://banjia-two.vercel.app/';
  const bg = ok ? '#26332C' : '#8a3b2f';
  const icon = ok ? '✅' : '⚠️';
  const msg = ok ? (already ? '这条任务之前就已完成' : '已标记完成，全家清单已同步') : '未能更新，请到网页里操作';
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${icon} ${ok ? '已完成' : '未完成'}</title>
<style>*{box-sizing:border-box}html,body{margin:0;height:100%}body{font-family:'Noto Sans SC',system-ui,sans-serif;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:420px;text-align:center}.icon{font-size:56px;line-height:1}.title{font-size:22px;font-weight:700;margin:16px 0 6px}.task{font-size:15px;opacity:.85;margin-bottom:8px}.msg{font-size:13.5px;opacity:.7;line-height:1.6}
a{display:inline-block;margin-top:22px;padding:11px 20px;border-radius:12px;background:rgba(255,255,255,.16);color:#fff;text-decoration:none;font-size:14px;font-weight:600}</style></head>
<body><div class="card"><div class="icon">${icon}</div><div class="title">${ok ? '任务已完成' : '暂未完成'}</div><div class="task">${esc(title)}</div><div class="msg">${msg}</div><a href="${app}">打开搬家清单 →</a></div></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
