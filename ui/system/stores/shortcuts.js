import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';

// 快捷指令：聊天「+」面板的常用语，以本机 roam.db 的 shortcuts 表为真相。设置页增删改排序。
export const useShortcutsStore = defineStore('shortcuts', () => {
    const ws = useWsStore();
    const items = ref([]);

    const pending = new Map();
    let seq = 0;
    let bound = false;

    function request(type, data = {}) {
        return new Promise((resolve) => {
            const reqId = `s${Date.now()}_${seq++}`;
            pending.set(reqId, resolve);
            const ok = ws.sendMsg({ type, to: 'desktop', data: { ...data, reqId } });
            if (!ok) { pending.delete(reqId); resolve(null); return; }
            setTimeout(() => { if (pending.has(reqId)) { pending.delete(reqId); resolve(null); } }, 15000);
        });
    }
    function onResult(msg) {
        const d = msg.data || {};
        const r = d.reqId && pending.get(d.reqId);
        if (r) { pending.delete(d.reqId); r(d); }
    }
    function bind() {
        if (bound) return;
        bound = true;
        for (const t of ['list', 'save', 'delete', 'reorder']) ws.onMessage(`shortcuts.${t}.result`, onResult);
    }

    async function load() {
        bind();
        const d = await request('chat.shortcuts.list');
        if (d?.ok) items.value = d.items || [];
    }
    async function save({ id, text }) {
        bind();
        const d = await request('chat.shortcuts.save', { id, text });
        await load();
        return d;
    }
    async function remove(id) {
        bind();
        const d = await request('chat.shortcuts.delete', { id });
        await load();
        return d;
    }
    async function reorder(ids) {
        bind();
        // 乐观更新顺序，再落库
        const byId = new Map(items.value.map((s) => [s.id, s]));
        items.value = ids.map((id) => byId.get(id)).filter(Boolean);
        await request('chat.shortcuts.reorder', { ids });
    }

    return { items, load, save, remove, reorder };
});
