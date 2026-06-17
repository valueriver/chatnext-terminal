// 对话 app 的纯分发层（零业务）：按子命名空间把 chat.* 路由到各子能力。
import conversation from './conversation/handle.js';
import model from './model/handle.js';
import shortcuts from './shortcuts/handle.js';
import attachments from './attachments/handle.js';

async function handle(message) {
    const t = message.type || '';
    if (t.startsWith('chat.shortcuts.')) return shortcuts.handle(message);
    if (t.startsWith('chat.attach.')) return attachments.handle(message);
    if (t.startsWith('chat.model.')) return model.handle(message);
    return conversation.handle(message); // 其余 chat.* —— 对话本身
}
export { handle };
export default { handle };
