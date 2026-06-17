import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';

// 笔记以本机 server（~/.one/one.db 的 notes 表）为唯一真相，经 WS notes.* 读写。
export const useNotesStore = defineStore('notes', () => {
    const ws = useWsStore();
    const items = ref([]);
    const page = ref(1);
    const pages = ref(1);
    const total = ref(0);
    const loading = ref(false);

    const pending = new Map();
    let seq = 0;
    let bound = false;

    function request(type, data = {}) {
        return new Promise((resolve) => {
            const reqId = `n${Date.now()}_${seq++}`;
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
        ws.onMessage('notes.list.result', onResult);
        ws.onMessage('notes.save.result', onResult);
        ws.onMessage('notes.delete.result', onResult);
    }

    async function load(p = page.value) {
        bind();
        loading.value = true;
        const d = await request('notes.list', { page: p });
        loading.value = false;
        if (d?.ok) {
            items.value = d.items || [];
            page.value = d.page || 1;
            pages.value = d.pages || 1;
            total.value = d.total || 0;
        }
    }
    async function save(payload) {
        bind();
        const d = await request('notes.save', payload);
        if (d?.ok) await load(1);
        return d;
    }
    async function remove(id) {
        bind();
        const d = await request('notes.delete', { id });
        if (d?.ok) await load();
        return d;
    }

    return { items, page, pages, total, loading, load, save, remove };
});
