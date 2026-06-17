// chat.send —— 发送一条并跑 agent loop（fire-and-forget，结果走 chat.event 流式）。
import { runSend } from '../runner.js';
export default function send(d) {
    runSend(d).catch((err) => console.error('chat.send 异常:', err?.message || err));
    return true;
}
