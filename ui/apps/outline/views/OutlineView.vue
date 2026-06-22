<script setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { useOutlineStore } from '@/apps/outline/store';
import { useWsStore } from '@/system/stores/ws';
import AppPanel from '@/system/components/AppPanel.vue';

const store = useOutlineStore();
const ws = useWsStore();
const rootId = ref(0);

const roots = computed(() => store.children(rootId.value));
const rootNode = computed(() => (rootId.value ? store.node(rootId.value) : null));
const crumbs = computed(() => {
    if (!rootId.value) return [];
    return [{ id: 0, text: '全部' }, ...store.ancestors(rootId.value)];
});

function zoom(id) { rootId.value = id; }
function onItemClick(item) {
    const kids = store.children(item.id);
    if (kids.length > 0) zoom(item.id);
}

async function addItem() {
    await store.create({ parentId: rootId.value || 0 });
}

function saveText(id, el) {
    const text = el.textContent.trim() || '';
    store.setTextLocal(id, text);
    store.saveText(id, text);
}

function onKey(e, id) {
    if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        saveText(id, e.target);
        addItem();
    }
}

async function toggleDone(id) {
    const n = store.node(id);
    if (!n) return;
    const text = n.text || '';
    if (text.startsWith('✓ ')) {
        store.setTextLocal(id, text.slice(2));
        store.saveText(id, text.slice(2));
    } else {
        store.setTextLocal(id, `✓ ${text}`);
        store.saveText(id, `✓ ${text}`);
    }
}
function isDone(n) { return (n.text || '').startsWith('✓ '); }
function displayText(n) {
    const t = n.text || '';
    return t.startsWith('✓ ') ? t.slice(2) : t;
}

async function delItem(id) {
    await store.remove(id);
}

async function load() { if (ws.canUseActions) await store.load(); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
watch(() => store.items, () => { if (rootId.value && !store.node(rootId.value)) rootId.value = 0; });

watch(() => store.focusWant, async (want) => {
    if (!want) return;
    await nextTick();
    const el = document.querySelector(`.ol-text[data-id="${want}"]`);
    if (el) { el.focus(); store.focusWant = 0; }
});
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink">大纲</div>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <!-- 面包屑 -->
                <div v-if="rootId" class="ol-breadcrumb">
                    <template v-for="(c, i) in crumbs" :key="c.id">
                        <span v-if="i > 0" class="ol-crumb-sep">›</span>
                        <button class="ol-crumb" @click="zoom(c.id)">{{ c.text || '（空）' }}</button>
                    </template>
                    <span class="ol-crumb-sep">›</span>
                    <span class="ol-crumb current">{{ rootNode?.text || '（空）' }}</span>
                </div>

                <!-- 当前层级标题 -->
                <div v-if="rootNode" class="ol-focus-title">{{ rootNode.text || '（空）' }}</div>
                <div v-if="rootNode && roots.length" class="ol-focus-desc">
                    {{ roots.length }} 个子项
                </div>

                <!-- 子项列表 -->
                <div class="ol-items">
                    <div v-for="item in roots" :key="item.id"
                        class="ol-item" :class="{ 'has-kids': store.children(item.id).length > 0 }">
                        <div class="ol-item-row" @click="onItemClick(item)">
                            <span class="ol-bullet"></span>
                            <span class="ol-text" :class="{ done: isDone(item) }"
                                :data-id="item.id"
                                contenteditable="true"
                                @click.stop
                                @blur="saveText(item.id, $event.target)"
                                @keydown="onKey($event, item.id)">{{ displayText(item) }}</span>
                            <div class="ol-actions">
                                <button class="ol-abtn" :class="{ 'done-on': isDone(item) }" @click.stop="toggleDone(item.id)">{{ isDone(item) ? '✓ 完成' : '完成' }}</button>
                                <button class="ol-abtn del" @click.stop="delItem(item.id)">删除</button>
                            </div>
                            <template v-if="store.children(item.id).length > 0">
                                <span class="ol-count">{{ store.children(item.id).length }}</span>
                                <span class="ol-arrow">›</span>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- 添加 -->
                <button class="ol-add" :disabled="!ws.canUseActions" @click="addItem">
                    <span class="text-[16px]">+</span> 添加项目
                </button>

                <div v-if="!roots.length" class="text-muted text-[13px] text-center py-10">
                    {{ ws.canUseActions ? '空白的画布。点「添加项目」开始。' : '未连接本机 Server，无法读取大纲。' }}
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
/* 面包屑 */
.ol-breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 14px;
}
.ol-crumb {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--color-muted);
    padding: 4px 10px;
    border-radius: 999px;
    transition: 0.12s;
}
.ol-crumb:hover {
    color: var(--color-accent);
    background: var(--accent-soft);
}
.ol-crumb.current {
    color: var(--color-ink);
    font-weight: 800;
    pointer-events: none;
}
.ol-crumb-sep {
    font-size: 10px;
    color: var(--color-faint);
}

/* 聚焦标题 */
.ol-focus-title {
    font-weight: 800;
    font-size: 20px;
    color: var(--color-ink);
    margin-bottom: 4px;
    letter-spacing: -0.3px;
}
.ol-focus-desc {
    font-size: 12px;
    color: var(--color-muted);
    margin-bottom: 16px;
}

/* 子项 */
.ol-items { margin-bottom: 4px; }
.ol-item {
    background: var(--color-bg-elev);
    border-radius: 14px;
    margin-bottom: 8px;
    border: 1px solid var(--color-line);
    overflow: hidden;
    transition: background 0.1s;
}
.ol-item-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    cursor: pointer;
}
.ol-item-row:hover { background: var(--color-bg-hi); }

.ol-bullet {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-muted);
    flex-shrink: 0;
    transition: 0.12s;
}
.ol-item-row:hover .ol-bullet { background: var(--color-accent); }
.ol-item.has-kids .ol-bullet {
    background: var(--color-accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
}

.ol-text {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    line-height: 1.6;
    outline: none;
    word-break: break-word;
    color: var(--color-ink);
}
.ol-text:empty::before {
    content: '未命名';
    color: var(--color-faint);
}
.ol-text.done {
    text-decoration: line-through;
    color: var(--color-muted);
}

.ol-count {
    font-size: 10px;
    font-weight: 700;
    color: var(--color-accent);
    background: var(--accent-soft);
    padding: 2px 8px;
    border-radius: 999px;
    flex-shrink: 0;
}
.ol-arrow {
    font-size: 11px;
    color: var(--color-muted);
    flex-shrink: 0;
}

.ol-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.1s;
    flex-shrink: 0;
}
.ol-item-row:hover .ol-actions { opacity: 1; }

.ol-abtn {
    font-size: 10px;
    color: var(--color-muted);
    padding: 3px 7px;
    border-radius: 5px;
    transition: 0.1s;
    font-weight: 600;
}
.ol-abtn:hover { color: var(--color-accent); background: var(--accent-soft); }
.ol-abtn.del:hover { color: var(--bad); background: var(--bad-soft); }
.ol-abtn.done-on { color: var(--win); }

/* 添加 */
.ol-add {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 14px;
    color: var(--color-muted);
    font-size: 12.5px;
    font-weight: 600;
    transition: 0.12s;
    margin-top: 4px;
}
.ol-add:hover { background: var(--accent-soft); color: var(--color-accent); }
.ol-add:disabled { opacity: 0.4; cursor: not-allowed; }
.ol-add:disabled:hover { background: transparent; color: var(--color-muted); }
</style>
