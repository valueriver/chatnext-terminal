import ws from './index.js';
import guard from '../auth/index.js';
import terminal from '../../apps/terminal/index.js';
import files from '../../apps/files/index.js';
import screen from '../../apps/screen/index.js';
import status from '../../apps/status/index.js';
import chat from '../../apps/chat/index.js';
import notes from '../../apps/notes/index.js';
import evolution from '../../apps/evolution/index.js';
import memories from '../../apps/memories/index.js';
import revelation from '../../apps/revelation/index.js';
import shortcuts from '../shortcuts/index.js';
import attachments from '../attachments/index.js';
import outline from '../../apps/outline/index.js';

let onDevicesChanged = () => {};

function bindOnDevicesChanged(fn) {
    onDevicesChanged = fn;
}

async function dispatch(message) {
    const t = message.type || '';

    if (t === 'connection.ping') {
        ws.send({ type: 'connection.pong', to: 'server', data: {} });
        return;
    }
    if (t === 'connection.devices') {
        onDevicesChanged(message.data?.devices);
        return;
    }
    if (t === 'connection.ready') return;

    if (t.startsWith('auth.')) {
        if (await guard.handle(message)) return;
    }
    if (t.startsWith('terminal.') || t.startsWith('data.') || t.startsWith('system.')) {
        if (await terminal.handle(message)) return;
    }
    if (t.startsWith('fs.')) {
        if (await files.handle(message)) return;
    }
    if (t.startsWith('screen.')) {
        if (await screen.handle(message)) return;
    }
    if (t.startsWith('status.')) {
        if (await status.handle(message)) return;
    }
    if (t.startsWith('ai.') || t.startsWith('model.')) {
        if (await chat.handle(message)) return;
    }
    if (t.startsWith('notes.')) {
        if (await notes.handle(message)) return;
    }
    if (t.startsWith('evolution.')) {
        if (await evolution.handle(message)) return;
    }
    if (t.startsWith('memories.')) {
        if (await memories.handle(message)) return;
    }
    if (t.startsWith('revelation.')) {
        if (await revelation.handle(message)) return;
    }
    if (t.startsWith('shortcuts.')) {
        if (await shortcuts.handle(message)) return;
    }
    if (t.startsWith('attach.')) {
        if (await attachments.handle(message)) return;
    }
    if (t.startsWith('outline.')) {
        if (await outline.handle(message)) return;
    }

    console.log('未识别的消息类型:', t);
}

export { dispatch, bindOnDevicesChanged };
export default { dispatch, bindOnDevicesChanged };
