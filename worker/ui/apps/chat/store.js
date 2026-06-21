import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import { api } from '@/system/api';
import { mkKey, renderMessages } from '@/apps/chat/lib/messages';
import { setupChatStream } from '@/apps/chat/lib/stream';

// 对话历史走 /apps/chats(REST);直播走 DO 的 WS(chat.send → chat.delta/tool/...)。
// DO 的新协议在这里翻译成 stream.js 认的事件 kind,复用其渲染机。
export const useChatStore = defineStore('chat', () => {
    const ws = useWsStore();

    const conversations = ref([]);
    const currentId = ref('');
    const currentTitle = ref('');
    const messages = ref([]);
    const busy = ref(false);
    const ready = ref(false);
    const streamTick = ref(0);
    const viewSeq = ref(0);
    const hasMore = ref(false);     // 云端一次返回全部历史,无分页
    const loadingOlder = ref(false);

    let bound = false;
    let stream = null;

    const pushRow = (row) => { messages.value.push(row); return messages.value[messages.value.length - 1]; };
    const bumpStream = () => { streamTick.value++; };

    function bind() {
        if (bound) return;
        bound = true;
        stream = setupChatStream({ messages, currentId, busy, pushRow, refresh, bumpStream });

        // 单一直播通道:chat.event 直接喂给 stream reducer,无翻译层。
        ws.onMessage('chat.event', (e) => stream.onEvent(e));
        // 设备截图(executor 经 channel 广播,type=chat.screenshot)
        ws.onMessage('chat.screenshot', (msg) => {
            const d = msg.data || {};
            if (!d.dataUrl) return;
            pushRow({ type: 'shot', _key: mkKey('shot'), dataUrl: d.dataUrl, at: d.at });
            bumpStream();
        });
    }

    async function refresh() {
        const d = await api.get('/apps/chats').catch(() => null);
        if (d) { conversations.value = (d.chats || []).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at })); ready.value = true; }
    }

    async function openChat(id) {
        currentId.value = id;
        stream?.resetStreaming();
        const d = await api.get(`/apps/chats/${id}`).catch(() => null);
        const raw = (d?.messages || []).map((m) => { try { return JSON.parse(m.body); } catch { return { role: m.role, content: m.body }; } });
        messages.value = renderMessages(raw);
        currentTitle.value = d?.chat?.title || '';
        busy.value = false;
        viewSeq.value++;
    }

    // 云端无分页,保留接口给 MessageStream 滚动调用
    async function loadOlder() { return 0; }

    // 新对话只进入空白态,不落库;首条消息发送时才真正创建(见 send)。
    function newChat() {
        currentId.value = '';
        currentTitle.value = '';
        messages.value = [];
        stream?.resetStreaming();
        viewSeq.value++;
    }

    async function rename(id, title) {
        await api.put(`/apps/chats/${id}`, { title }).catch(() => {});
        const c = conversations.value.find((x) => x.id === id);
        if (c) c.title = title;
        if (currentId.value === id) currentTitle.value = title;
    }

    async function remove(id) {
        await api.del(`/apps/chats/${id}`).catch(() => {});
        conversations.value = conversations.value.filter((c) => c.id !== id);
        if (currentId.value === id) { currentId.value = ''; messages.value = []; currentTitle.value = ''; }
    }

    async function send(text, _attachments = []) {
        const content = (text || '').trim();
        if (!content || busy.value) return;
        // 首条消息才真正创建对话,标题取前 20 字
        if (!currentId.value) {
            const d = await api.post('/apps/chats', { title: content.slice(0, 20) }).catch(() => null);
            if (!d?.chat) return;
            conversations.value.unshift({ id: d.chat.id, title: d.chat.title, updatedAt: d.chat.updated_at });
            currentId.value = d.chat.id;
            currentTitle.value = d.chat.title;
        }
        pushRow({ role: 'user', _key: mkKey('user'), content, attachments: [] });
        busy.value = true;
        viewSeq.value++;
        bumpStream();
        ws.sendMsg({ t: 'chat.send', chatId: currentId.value, text: content });
    }

    function abort() {
        // DO 暂不支持中断进行中的回合,这里先软停 UI。
        busy.value = false;
        stream?.resetStreaming();
        bumpStream();
    }

    return {
        conversations, currentId, currentTitle, messages, busy, ready,
        streamTick, viewSeq, hasMore, loadingOlder,
        bind, refresh, openChat, loadOlder, newChat, rename, remove, send, abort,
    };
});
