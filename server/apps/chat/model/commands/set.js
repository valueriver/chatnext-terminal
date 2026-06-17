// chat.model.set —— 写模型配置。
import { writeConfig, publicView } from '../../../../system/ai/config.js';
import { reply } from '../shared.js';
export default async function set(d) {
    reply('chat.model.set.result', d.reqId, { ok: true, config: publicView(await writeConfig(d.config || {})) });
    return true;
}
