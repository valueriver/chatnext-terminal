// revelation.run —— 手动触发一次自我升级生成。
import { generate } from '../generate.js';
import { reply } from '../shared.js';

export default async function run(d) {
    const id = await generate({ force: true });
    reply('revelation.run.result', d.reqId, { ok: Boolean(id), id: id || null });
    return true;
}
