import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';

// 大纲：树形无限嵌套，以本机 one.db 的 outline 表为真相。
// 结构性操作（增删/缩进/移动）后重拉全树；纯文本编辑只持久化不重拉，避免打断输入。
export const useOutlineStore = defineStore('outline', () => {
    const ws = useWsStore();
    const items = ref([]); // 扁平 [{id, parent_id, sort, text, collapsed}]
    const focusWant = ref(0); // 期望获得编辑焦点的节点 id（新建后用）

    const pending = new Map();
    let seq = 0;
    let bound = false;

    function request(type, data = {}) {
        return new Promise((resolve) => {
            const reqId = `o${Date.now()}_${seq++}`;
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
        for (const t of ['list', 'create', 'update', 'delete', 'indent', 'outdent', 'move']) {
            ws.onMessage(`outline.${t}.result`, onResult);
        }
    }

    // 子节点 map：parent_id -> 已排序的子节点数组
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
        bind();
        const d = await request('outline.list');
        if (d?.ok) items.value = d.items || [];
    }
    async function create({ parentId = 0, afterId = 0, text = '' } = {}) {
        bind();
        const d = await request('outline.create', { parentId, afterId, text });
        await load();
        if (d?.id) focusWant.value = d.id;
        return d?.id || 0;
    }
    // 文本：本地即时改 + 持久化，不重拉（保住光标）
    function setTextLocal(id, text) { const n = node(id); if (n) n.text = text; }
    async function saveText(id, text) { bind(); await request('outline.update', { id, text }); }
    async function toggleCollapse(id) {
        bind();
        const n = node(id); if (!n) return;
        n.collapsed = n.collapsed ? 0 : 1;
        await request('outline.update', { id, collapsed: n.collapsed });
    }
    async function remove(id) { bind(); await request('outline.delete', { id }); await load(); }
    async function indent(id) { bind(); await request('outline.indent', { id }); await load(); focusWant.value = id; }
    async function outdent(id) { bind(); await request('outline.outdent', { id }); await load(); focusWant.value = id; }
    async function move(id, dir) { bind(); await request('outline.move', { id, dir }); await load(); focusWant.value = id; }

    return {
        items, focusWant, children, node, ancestors,
        load, create, setTextLocal, saveText, toggleCollapse, remove, indent, outdent, move,
    };
});
