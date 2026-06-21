import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/system/api';

// 大纲:树形无限嵌套,云端 D1 的 outlines 表(经 /apps/outlines REST)。
// 结构性操作(增删/缩进/移动)后重拉全树;纯文本编辑只持久化不重拉,避免打断输入。
export const useOutlineStore = defineStore('outline', () => {
    const items = ref([]); // 扁平 [{id, parent_id, sort, text, collapsed}]
    const focusWant = ref(0);

    const childrenOf = computed(() => {
        const map = new Map();
        for (const it of items.value) {
            const p = it.parent_id || 0;
            if (!map.has(p)) map.set(p, []);
            map.get(p).push(it);
        }
        for (const arr of map.values()) arr.sort((a, b) => a.sort - b.sort || a.id - b.id);
        return map;
    });
    function children(parentId) { return childrenOf.value.get(parentId || 0) || []; }
    function node(id) { return items.value.find((n) => n.id === id); }
    function ancestors(id) {
        const chain = [];
        let cur = node(id);
        while (cur && cur.parent_id) { cur = node(cur.parent_id); if (cur) chain.unshift(cur); }
        return chain;
    }

    async function load() {
        try { items.value = (await api.get('/apps/outlines')).nodes || []; } catch { /* ignore */ }
    }
    async function create({ parentId = 0, afterId = 0, text = '' } = {}) {
        const d = await api.post('/apps/outlines', { parentId, afterId, text }).catch(() => null);
        await load();
        if (d?.id) focusWant.value = d.id;
        return d?.id || 0;
    }
    function setTextLocal(id, text) { const n = node(id); if (n) n.text = text; }
    async function saveText(id, text) { await api.put(`/apps/outlines/${id}`, { text }).catch(() => {}); }
    async function toggleCollapse(id) {
        const n = node(id); if (!n) return;
        n.collapsed = n.collapsed ? 0 : 1;
        await api.put(`/apps/outlines/${id}`, { collapsed: n.collapsed }).catch(() => {});
    }
    async function setDone(id, done) {
        const n = node(id); if (n) n.done = done ? 1 : 0;
        await api.put(`/apps/outlines/${id}`, { done: done ? 1 : 0 }).catch(() => {});
    }
    async function remove(id) { await api.del(`/apps/outlines/${id}`).catch(() => {}); await load(); }
    async function indent(id) { await api.put(`/apps/outlines/${id}`, { op: 'indent' }).catch(() => {}); await load(); focusWant.value = id; }
    async function outdent(id) { await api.put(`/apps/outlines/${id}`, { op: 'outdent' }).catch(() => {}); await load(); focusWant.value = id; }
    async function move(id, dir) { await api.put(`/apps/outlines/${id}`, { op: 'move', dir }).catch(() => {}); await load(); focusWant.value = id; }

    return {
        items, focusWant, children, node, ancestors,
        load, create, setTextLocal, saveText, toggleCollapse, setDone, remove, indent, outdent, move,
    };
});
