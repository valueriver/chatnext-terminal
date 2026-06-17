// chat.shortcuts.list —— 列出快捷指令。
import { getDb } from '../../../../system/db.js';
import { reply } from '../shared.js';
export default function list(d) {
    const items = getDb().prepare('SELECT id, text, sort FROM shortcuts ORDER BY sort, id').all();
    reply('chat.shortcuts.list.result', d.reqId, { ok: true, items });
    return true;
}
