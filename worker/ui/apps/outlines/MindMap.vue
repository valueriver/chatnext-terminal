<script setup>
// 思维导图画布:横向树。根在左,分支向右,贝塞尔连线。无限嵌套。
// 交互:点节点改字 · Tab 加子 · 回车加同级 · Backspace 空则删 · 双击聚焦分支 · 拖背景平移 · 滚轮缩放。
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useOutlineStore } from '@/apps/outlines/store';

const props = defineProps({ rootId: { type: Number, default: 0 } });
const emit = defineEmits(['zoom']);
const store = useOutlineStore();

const NODE_W = 190;
const GAP_X = 56;
const ROW = 64;
const NODE_CY = 22; // 连线接点的竖直偏移(节点视觉中心)

const VROOT = { id: 0, text: '我的思路', _virtual: true };
const rootNode = computed(() => (props.rootId ? store.node(props.rootId) || VROOT : VROOT));

// 布局:后序遍历,叶子顺次占行,父节点取子节点中点。折叠节点当叶子。
const layout = computed(() => {
    const list = store.items; // 依赖,触发重算
    void list;
    const pos = new Map();
    let cursorY = 0;
    const root = rootNode.value;

    const kidsOf = (n) => {
        if (n._virtual) return store.children(0);
        if (n.id !== root.id && n.collapsed) return [];
        return store.children(n.id);
    };
    const place = (n, depth) => {
        const kids = kidsOf(n);
        const x = depth * (NODE_W + GAP_X);
        const realKids = n._virtual ? store.children(0).length : store.children(n.id).length;
        if (!kids.length) {
            const y = cursorY; cursorY += ROW;
            pos.set(n.id, { id: n.id, x, y, node: n, hasKids: realKids > 0, kidCount: realKids });
            return y;
        }
        const ys = kids.map((k) => place(k, depth + 1));
        const y = (ys[0] + ys[ys.length - 1]) / 2;
        pos.set(n.id, { id: n.id, x, y, node: n, hasKids: true, kidCount: realKids });
        return y;
    };
    place(root, 0);

    const edges = [];
    for (const p of pos.values()) {
        if (p.node._virtual) continue;
        const parentKey = p.node.parent_id || 0;
        const pp = pos.get(parentKey);
        if (pp && parentKey !== p.id) edges.push({ from: pp, to: p });
    }
    let w = 0; let h = 0;
    for (const p of pos.values()) { w = Math.max(w, p.x + NODE_W); h = Math.max(h, p.y + ROW); }
    return { nodes: [...pos.values()], edges, w: w + 40, h: h + 40 };
});

function edgePath(e) {
    const x1 = e.from.x + NODE_W; const y1 = e.from.y + NODE_CY;
    const x2 = e.to.x; const y2 = e.to.y + NODE_CY;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

// ── 平移 / 缩放 ──
const stage = ref(null);
const pan = ref({ x: 40, y: 40 });
const scale = ref(1);
const transform = computed(() => `translate(${pan.value.x}px, ${pan.value.y}px) scale(${scale.value})`);

let dragging = false; let last = { x: 0, y: 0 };
function onPanStart(e) {
    if (e.target.closest('.mm-node')) return; // 点在节点上不平移
    dragging = true; last = { x: e.clientX, y: e.clientY };
    window.addEventListener('mousemove', onPanMove);
    window.addEventListener('mouseup', onPanEnd);
}
function onPanMove(e) {
    if (!dragging) return;
    pan.value = { x: pan.value.x + (e.clientX - last.x), y: pan.value.y + (e.clientY - last.y) };
    last = { x: e.clientX, y: e.clientY };
}
function onPanEnd() { dragging = false; window.removeEventListener('mousemove', onPanMove); window.removeEventListener('mouseup', onPanEnd); }
function onWheel(e) {
    const next = Math.min(1.8, Math.max(0.4, scale.value - e.deltaY * 0.0015));
    scale.value = Math.round(next * 100) / 100;
}
function zoomBy(d) { scale.value = Math.min(1.8, Math.max(0.4, Math.round((scale.value + d) * 100) / 100)); }

// 把根节点摆到左侧竖直居中
function center() {
    const el = stage.value; if (!el) return;
    const root = layout.value.nodes.find((n) => n.id === rootNode.value.id);
    pan.value = { x: 48, y: Math.max(24, el.clientHeight / 2 - (root ? (root.y + NODE_CY) * scale.value : 0)) };
}
onMounted(() => nextTick(center));
watch(() => props.rootId, () => nextTick(center));

// ── 编辑 ──
const editingId = ref(0);
const taRef = ref(null);
let saveTimer = null;

function startEdit(p) {
    if (p.node._virtual) return;
    editingId.value = p.id;
    nextTick(() => { const t = taRef.value?.[0] || taRef.value; t?.focus?.(); });
}
function onInput(id, e) {
    store.setTextLocal(id, e.target.value);
    clearTimeout(saveTimer); saveTimer = setTimeout(() => store.saveText(id, e.target.value), 400);
}
function flush(id, text) { clearTimeout(saveTimer); store.saveText(id, text || ''); }
function onKey(p, e) {
    const id = p.id; const n = p.node;
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault(); flush(id, n.text);
        store.create({ parentId: n.parent_id || 0, afterId: id });
    } else if (e.key === 'Tab') {
        e.preventDefault(); flush(id, n.text);
        store.create({ parentId: id });
    } else if (e.key === 'Backspace' && !n.text) {
        e.preventDefault(); store.remove(id);
    } else if (e.key === 'Escape') {
        e.preventDefault(); editingId.value = 0; flush(id, n.text);
    }
}
function addChild(p) { store.create({ parentId: p.node._virtual ? 0 : p.id }); }

// 新建节点后自动进入编辑
watch(() => store.focusWant, (w) => { if (w) { editingId.value = w; nextTick(() => { const t = taRef.value?.[0] || taRef.value; t?.focus?.(); }); store.focusWant = 0; } });
</script>

<template>
    <div ref="stage" class="mm-stage" @mousedown="onPanStart" @wheel.prevent="onWheel">
        <div class="mm-canvas" :style="{ transform, width: `${layout.w}px`, height: `${layout.h}px` }">
            <svg class="mm-edges" :width="layout.w" :height="layout.h">
                <path v-for="(e, i) in layout.edges" :key="i" :d="edgePath(e)" />
            </svg>

            <div
                v-for="p in layout.nodes" :key="p.id"
                class="mm-node" :class="{ root: p.id === rootNode.id, virtual: p.node._virtual, done: p.node.done }"
                :style="{ left: `${p.x}px`, top: `${p.y}px`, width: `${NODE_W}px` }"
                @mousedown.stop
                @click="startEdit(p)"
                @dblclick.stop="!p.node._virtual && emit('zoom', p.id)"
            >
                <textarea
                    v-if="editingId === p.id" ref="taRef" rows="1" :value="p.node.text" placeholder="未命名" spellcheck="false"
                    class="mm-text-edit"
                    @input="onInput(p.id, $event)" @keydown="onKey(p, $event)" @blur="editingId = 0; flush(p.id, p.node.text)"
                ></textarea>
                <div v-else class="mm-text">{{ p.node.text || (p.node._virtual ? '我的思路' : '未命名') }}</div>

                <!-- 折叠分支 -->
                <button
                    v-if="p.hasKids && !p.node._virtual" class="mm-collapse" :class="{ on: p.node.collapsed }"
                    :title="p.node.collapsed ? `展开(${p.kidCount})` : '折叠'"
                    @mousedown.prevent.stop="store.toggleCollapse(p.id)"
                >{{ p.node.collapsed ? p.kidCount : '−' }}</button>

                <!-- 加子节点 -->
                <button class="mm-add" title="加子节点" @mousedown.prevent.stop="addChild(p)">+</button>
            </div>
        </div>

        <!-- 缩放控制 -->
        <div class="mm-ctrl">
            <button @click="zoomBy(0.1)">＋</button>
            <button @click="zoomBy(-0.1)">－</button>
            <button class="fit" title="居中" @click="center">◎</button>
        </div>
    </div>
</template>

<style scoped>
.mm-stage { position: relative; height: 100%; width: 100%; overflow: hidden; cursor: grab; user-select: none; }
.mm-stage:active { cursor: grabbing; }
.mm-canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }

.mm-edges { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
.mm-edges path { fill: none; stroke: var(--line2); stroke-width: 2; }

.mm-node {
    position: absolute; box-sizing: border-box;
    min-height: 40px; display: flex; align-items: center;
    padding: 9px 13px; border-radius: 14px;
    background: var(--panel); border: 1px solid var(--line);
    box-shadow: 0 4px 14px #0000000f; cursor: text;
}
.mm-node.root { background: linear-gradient(135deg, var(--accent), var(--accent-d)); border-color: transparent; box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 40%, transparent); }
.mm-node.root .mm-text, .mm-node.root .mm-text-edit { color: #fff; font-weight: 800; }
.mm-node.done .mm-text { color: var(--faint); text-decoration: line-through; }

.mm-text { width: 100%; font-family: var(--sans); font-size: 13.5px; line-height: 1.55; color: var(--ink); white-space: pre-wrap; word-break: break-word; }
.mm-text-edit { width: 100%; resize: none; border: 0; background: transparent; outline: none; font-family: var(--sans); font-size: 13.5px; line-height: 1.55; color: var(--ink); }
.mm-text-edit::placeholder { color: var(--faint); }

.mm-collapse {
    position: absolute; right: -11px; top: 50%; transform: translateY(-50%);
    height: 20px; min-width: 20px; padding: 0 5px; border-radius: 999px;
    background: var(--panel); border: 1px solid var(--line2); color: var(--muted);
    font-size: 11px; font-weight: 800; line-height: 1; display: grid; place-items: center; z-index: 2;
}
.mm-collapse:hover { color: var(--ink); }
.mm-collapse.on { background: var(--accent-soft); color: var(--accent-d); border-color: transparent; }

.mm-add {
    position: absolute; right: -11px; bottom: -11px;
    height: 20px; width: 20px; border-radius: 999px;
    background: var(--accent); color: #fff; font-size: 14px; line-height: 1;
    display: grid; place-items: center; opacity: 0; transition: opacity .12s; z-index: 2;
    box-shadow: 0 2px 6px #0003;
}
.mm-node:hover .mm-add { opacity: 1; }
.mm-node.root .mm-collapse { right: -11px; }

.mm-ctrl { position: absolute; right: 14px; bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
.mm-ctrl button {
    height: 34px; width: 34px; border-radius: 10px; background: var(--glass); backdrop-filter: blur(8px);
    border: 1px solid var(--line); color: var(--ink2); font-size: 15px; display: grid; place-items: center;
    box-shadow: 0 4px 12px #0000000f;
}
.mm-ctrl button:hover { color: var(--ink); }
</style>
