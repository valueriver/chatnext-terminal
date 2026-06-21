import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import { api } from '@/system/api';
import { mkKey, renderMessages } from '@/apps/chat/lib/messages';
import { setupChatStream } from '@/apps/chat/lib/stream';

// 历史行的 body 是 JSON 字符串(整条消息),解析失败兜底为 {role, content}
const parseBody = (m) => { try { return JSON.parse(m.body); } catch { return { role: m.role, content: m.body }; } };

// 对话历史走 /apps/chats(REST);直播走 DO 的 WS(发 chat.send,收单一通道 chat.event)。
// chat.event 直接喂给 stream reducer(按 kind 分支),无翻译层。
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
    const hasMore = ref(false);     // 是否还有更早的历史可加载
    const loadingOlder = ref(false);
    const PAGE = 50;
    let oldestId = 0;               // 已加载的最小消息 id,作往前翻页游标

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
        const d = await api.get(`/apps/chats/${id}?limit=${PAGE}`).catch(() => null);
        const rows = d?.messages || [];
        oldestId = rows[0]?.id || 0;
        hasMore.value = Boolean(d?.hasMore);
        messages.value = renderMessages(rows.map(parseBody));
        currentTitle.value = d?.chat?.title || '';
        busy.value = false;
        viewSeq.value++;
    }

    // 上滑加载更早一页:往 messages 头部插入,返回本次条数(MessageStream 据此维持滚动位置)
    async function loadOlder() {
        if (!hasMore.value || loadingOlder.value || !currentId.value || !oldestId) return 0;
        loadingOlder.value = true;
        try {
            const d = await api.get(`/apps/chats/${currentId.value}?before=${oldestId}&limit=${PAGE}`).catch(() => null);
            const rows = d?.messages || [];
            if (!rows.length) { hasMore.value = false; return 0; }
            oldestId = rows[0].id;
            hasMore.value = Boolean(d?.hasMore);
            messages.value = [...renderMessages(rows.map(parseBody)), ...messages.value];
            return rows.length;
        } finally {
            loadingOlder.value = false;
        }
    }

    // 新对话只进入空白态,不落库;首条消息发送时才真正创建(见 send)。
    function newChat() {
        currentId.value = '';
        currentTitle.value = '';
        messages.value = [];
        oldestId = 0;
        hasMore.value = false;
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
        ws.sendMsg({ type: 'chat.send', chatId: currentId.value, text: content });
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
