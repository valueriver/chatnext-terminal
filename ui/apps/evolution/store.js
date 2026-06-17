import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';

// 进化：AI 自我演化的人设/原则时间轴，以本机 one.db 的 evolution 表为真相。AI 经 sql 工具写，前端只读 + 删。
export const useEvolutionStore = defineStore('evolution', () => {
    const ws = useWsStore();
    const items = ref([]);
    const loading = ref(false);

    const pending = new Map();
    let seq = 0;
    let bound = false;

    function request(type, data = {}) {
        return new Promise((resolve) => {
            const reqId = `e${Date.now()}_${seq++}`;
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
        ws.onMessage('evolution.list.result', onResult);
        ws.onMessage('evolution.delete.result', onResult);
    }

    async function load() {
        bind();
        loading.value = true;
        const d = await request('evolution.list');
        loading.value = false;
        if (d?.ok) items.value = d.items || [];
    }
    async function remove(id) {
        bind();
        const d = await request('evolution.delete', { id });
        if (d?.ok) await load();
        return d;
    }

    return { items, loading, load, remove };
});
