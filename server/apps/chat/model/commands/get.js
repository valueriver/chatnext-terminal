// chat.model.get —— 读模型配置（安全视图）。
import { readConfig, publicView } from '../../../../system/ai/config.js';
import { reply } from '../shared.js';
export default async function get(d) {
    reply('chat.model.get.result', d.reqId, { config: publicView(await readConfig()) });
    return true;
}
