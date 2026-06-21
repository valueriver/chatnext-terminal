<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useOutlineStore } from '@/apps/outlines/store';

const props = defineProps({ id: { type: Number, required: true } });
const emit = defineEmits(['zoom']);
const store = useOutlineStore();

const node = computed(() => store.node(props.id) || { id: props.id, text: '', collapsed: 0, done: 0 });
const kids = computed(() => store.children(props.id));
const hasKids = computed(() => kids.value.length > 0);
const focused = ref(false);
const menuOpen = ref(false);
const taRef = ref(null);

function fit(el) { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }
const vGrow = { mounted: fit, updated: fit };

let saveTimer = null;
function onInput(e) {
    store.setTextLocal(props.id, e.target.value); fit(e.target);
    clearTimeout(saveTimer); saveTimer = setTimeout(() => store.saveText(props.id, e.target.value), 400);
}
function flush() { clearTimeout(saveTimer); store.saveText(props.id, node.value.text || ''); }
function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); flush(); store.create({ parentId: node.value.parent_id || 0, afterId: props.id }); }
    else if (e.key === 'Tab') { e.preventDefault(); flush(); e.shiftKey ? store.outdent(props.id) : store.indent(props.id); }
    else if (e.key === 'Backspace' && !node.value.text) { e.preventDefault(); store.remove(props.id); }
}

function act(fn) { menuOpen.value = false; fn(); }

watch(() => store.focusWant, async (w) => { if (w === props.id) { await nextTick(); taRef.value?.focus(); store.focusWant = 0; } });
watch(() => node.value.text, () => nextTick(() => fit(taRef.value)));
</script>

<template>
    <div>
        <div class="onode group" :class="{ 'is-focus': focused }">
            <!-- 折叠 -->
            <button
                class="onode-caret" :class="{ invisible: !hasKids }"
                @click="store.toggleCollapse(id)"
            >
                <svg width="9" height="9" viewBox="0 0 10 10" class="transition-transform duration-150" :class="node.collapsed ? '' : 'rotate-90'">
                    <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
            <!-- 圆点(点聚焦) -->
            <button class="onode-bullet" title="聚焦" @click="emit('zoom', id)">
                <span class="dot" :class="{ collapsed: node.collapsed }"></span>
            </button>
            <!-- 文本 -->
            <textarea
                ref="taRef" v-grow rows="1" :value="node.text" placeholder="未命名" spellcheck="false"
                class="onode-text" :class="node.done ? 'is-done' : ''"
                @input="onInput" @keydown="onKey" @focus="focused = true" @blur="focused = false; flush()"
            ></textarea>
            <!-- 操作:收进 ⋯ 菜单 -->
            <div class="onode-more" :class="{ shown: focused || menuOpen }">
                <button class="onode-dots" title="更多" @mousedown.prevent="menuOpen = !menuOpen">⋯</button>
                <template v-if="menuOpen">
                    <div class="onode-mask" @mousedown.prevent="menuOpen = false"></div>
                    <div class="onode-menu">
                        <button @mousedown.prevent="act(() => store.setDone(id, !node.done))">{{ node.done ? '取消完成' : '标记完成' }}</button>
                        <button @mousedown.prevent="act(() => store.indent(id))">缩进</button>
                        <button @mousedown.prevent="act(() => store.outdent(id))">反缩进</button>
                        <button class="danger" @mousedown.prevent="act(() => store.remove(id))">删除</button>
                    </div>
                </template>
            </div>
        </div>
        <!-- 子树:引导线 -->
        <div v-if="!node.collapsed && hasKids" class="onode-kids">
            <OutlineNode v-for="c in kids" :key="c.id" :id="c.id" @zoom="emit('zoom', $event)" />
        </div>
    </div>
</template>

<style scoped>
.onode { display: flex; align-items: flex-start; gap: 2px; padding-right: 4px; border-radius: 12px; transition: background .12s; }
.onode:hover { background: var(--well); }
.onode.is-focus { background: var(--well); }

.onode-caret { display: grid; place-items: center; height: 34px; width: 22px; flex-shrink: 0; color: var(--faint); opacity: 0; transition: opacity .12s, color .12s; }
.onode:hover .onode-caret, .onode.is-focus .onode-caret { opacity: 1; }

.onode-bullet { display: grid; place-items: center; height: 34px; width: 20px; flex-shrink: 0; }
.dot { height: 6px; width: 6px; border-radius: 999px; background: var(--muted); transition: background .15s, box-shadow .15s; }
.group:hover .dot { background: var(--accent); }
.dot.collapsed { box-shadow: 0 0 0 4px color-mix(in srgb, var(--muted) 18%, transparent); }

.onode-text {
    min-width: 0; flex: 1; resize: none; border: 0; background: transparent;
    padding: 6px 0; font-family: var(--sans); font-size: 15px; line-height: 1.7; color: var(--ink);
    outline: none;
}
.onode-text::placeholder { color: var(--faint); }
.onode-text.is-done { color: var(--faint); text-decoration: line-through; }

.onode-more { position: relative; align-self: center; flex-shrink: 0; opacity: 0; transition: opacity .12s; }
.onode-more.shown { opacity: 1; }
.onode-dots { height: 28px; width: 28px; display: grid; place-items: center; border-radius: 8px; color: var(--faint); font-size: 16px; line-height: 1; transition: background .12s, color .12s; }
.onode-dots:hover { background: var(--well); color: var(--ink); }

.onode-mask { position: fixed; inset: 0; z-index: 40; }
.onode-menu {
    position: absolute; top: calc(100% + 4px); right: 0; z-index: 50;
    min-width: 132px; padding: 5px; border-radius: 14px;
    background: var(--panel); border: 1px solid var(--line);
    box-shadow: 0 14px 40px #00000022;
}
.onode-menu button {
    display: block; width: 100%; text-align: left; padding: 8px 10px; border-radius: 9px;
    font-size: 13px; font-weight: 600; color: var(--ink); transition: background .12s;
}
.onode-menu button:hover { background: var(--well); }
.onode-menu button.danger { color: var(--bad); }
.onode-menu button.danger:hover { background: var(--bad-soft); }

.onode-kids { margin-left: 24px; border-left: 1px solid var(--line); padding-left: 2px; }
@media (max-width: 640px) { .onode-kids { margin-left: 20px; } }
</style>
