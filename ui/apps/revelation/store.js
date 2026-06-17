import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';

// 启示：自我升级每天产出的深度报告，以本机 one.db 的 reports 表为真相。
export const useRevelationStore = defineStore('revelation', () => {
    const ws = useWsStore();
    const items = ref([]);
    const loading = ref(false);
    const running = ref(false);
    const detail = ref({});

    const pending = new Map();
    let seq = 0;
    let bound = false;

    function request(type, data = {}, timeout = 15000) {
        return new Promise((resolve) => {
            const reqId = `r${Date.now()}_${seq++}`;
            pending.set(reqId, resolve);
            const ok = ws.sendMsg({ type, to: 'desktop', data: { ...data, reqId } });
            if (!ok) { pending.delete(reqId); resolve(null); return; }
            setTimeout(() => { if (pending.has(reqId)) { pending.delete(reqId); resolve(null); } }, timeout);
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
        ws.onMessage('revelation.list.result', onResult);
        ws.onMessage('revelation.get.result', onResult);
        ws.onMessage('revelation.delete.result', onResult);
        ws.onMessage('revelation.run.result', onResult);
    }

    async function load() {
        bind();
        loading.value = true;
        const d = await request('revelation.list');
        loading.value = false;
        if (d?.ok) items.value = d.items || [];
    }
    async function open(id) {
        bind();
        if (detail.value[id]) return detail.value[id];
        const d = await request('revelation.get', { id });
        if (d?.ok && d.report) detail.value = { ...detail.value, [id]: d.report };
        return detail.value[id];
    }
    async function remove(id) {
        bind();
        const d = await request('revelation.delete', { id });
        if (d?.ok) await load();
        return d;
    }
    // 自我升级跑 agent loop，可能数十秒，超时给到 5 分钟。
    async function runNow() {
        bind();
        running.value = true;
        const d = await request('revelation.run', {}, 300000);
        running.value = false;
        if (d?.ok) await load();
        return d;
    }

    return { items, loading, running, detail, load, open, remove, runNow };
});
