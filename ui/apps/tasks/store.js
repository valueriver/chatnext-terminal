import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';

// 任务：观察「给应用调用的通道」跑出的 AI 任务。进度经 WS task.update / task.event 实时更新。
export const useTasksStore = defineStore('tasks', () => {
    const ws = useWsStore();
    const items = ref([]);
    const detail = ref({ task: null, messages: [] });
    const openId = ref(0);

    const pending = new Map();
    let seq = 0;
    let bound = false;

    function request(type, data = {}) {
        return new Promise((resolve) => {
            const reqId = `t${Date.now()}_${seq++}`;
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
        for (const t of ['list', 'get', 'abort', 'run']) ws.onMessage(`tasks.${t}.result`, onResult);
        // 实时进度：任务状态变更 / 过程事件
        ws.onMessage('task.update', (msg) => {
            const d = msg.data || {};
            load();
            if (d.id && d.id === openId.value) open(openId.value);
        });
        ws.onMessage('task.event', (msg) => {
            const d = msg.data || {};
            if (d.id && d.id === openId.value) open(openId.value);
        });
    }

    async function load() {
        bind();
        const d = await request('tasks.list');
        if (d?.ok) items.value = d.items || [];
    }
    async function open(id) {
        bind();
        openId.value = id;
        const d = await request('tasks.get', { id });
        if (d?.ok) detail.value = { task: d.task, messages: d.messages || [] };
    }
    function close() { openId.value = 0; detail.value = { task: null, messages: [] }; }
    async function run({ name, prompt }) {
        bind();
        const d = await request('tasks.run', { name, prompt });
        await load();
        if (d?.ok && d.id) await open(d.id);
        return d;
    }
    async function abort(id) { bind(); await request('tasks.abort', { id }); }

    return { items, detail, openId, load, open, close, run, abort };
});
