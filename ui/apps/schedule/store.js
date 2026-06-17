import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';

// 排程：定时触发任务的规则。以本机 one.db 的 schedules 表为真相；每条触发的任务记在 schedule_runs。
export const useScheduleStore = defineStore('schedule', () => {
    const ws = useWsStore();
    const items = ref([]);     // 排程列表
    const runs = ref([]);      // 当前打开排程触发的任务列表

    const pending = new Map();
    let seq = 0;
    let bound = false;

    function request(type, data = {}) {
        return new Promise((resolve) => {
            const reqId = `sc${Date.now()}_${seq++}`;
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
        for (const t of ['list', 'save', 'delete', 'toggle', 'tasks']) ws.onMessage(`schedule.${t}.result`, onResult);
        // 排程触发新任务时，任务广播 task.update —— 若正看某排程的任务列表，刷新它
        ws.onMessage('task.update', () => { if (openId.value) tasksOf(openId.value); });
    }

    const openId = ref(0);

    async function load() { bind(); const d = await request('schedule.list'); if (d?.ok) items.value = d.items || []; }
    async function save(payload) { bind(); const d = await request('schedule.save', payload); await load(); return d; }
    async function remove(id) { bind(); await request('schedule.delete', { id }); if (openId.value === id) openId.value = 0; await load(); }
    async function toggle(id, enabled) { bind(); await request('schedule.toggle', { id, enabled }); await load(); }
    async function tasksOf(scheduleId) { bind(); openId.value = scheduleId; const d = await request('schedule.tasks', { scheduleId }); if (d?.ok) runs.value = d.items || []; }
    function close() { openId.value = 0; runs.value = []; }

    return { items, runs, openId, load, save, remove, toggle, tasksOf, close };
});
