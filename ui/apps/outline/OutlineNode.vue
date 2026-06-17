<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useOutlineStore } from '@/apps/outline/store';

const props = defineProps({
    id: { type: Number, required: true },
    depth: { type: Number, default: 0 },
});
const emit = defineEmits(['zoom']);
const store = useOutlineStore();

const node = computed(() => store.node(props.id) || { id: props.id, text: '', collapsed: 0 });
const kids = computed(() => store.children(props.id));
const hasKids = computed(() => kids.value.length > 0);
const focused = ref(false);
const taRef = ref(null);

let saveTimer = null;
function onInput(e) {
    const v = e.target.value;
    store.setTextLocal(props.id, v);
    grow();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.saveText(props.id, v), 400);
}
function grow() {
    const el = taRef.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
}

function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        flush();
        store.create({ parentId: node.value.parent_id || 0, afterId: props.id });
    } else if (e.key === 'Tab') {
        e.preventDefault();
        flush();
        if (e.shiftKey) store.outdent(props.id); else store.indent(props.id);
    } else if (e.key === 'Backspace' && !node.value.text) {
        e.preventDefault();
        store.remove(props.id);
    }
}
function flush() { clearTimeout(saveTimer); store.saveText(props.id, node.value.text || ''); }

// 新建/结构操作后抢占焦点
watch(() => store.focusWant, async (want) => {
    if (want === props.id) {
        await nextTick();
        taRef.value?.focus();
        store.focusWant = 0;
    }
});
watch(() => node.value.text, () => nextTick(grow));
</script>

<template>
    <div class="select-none">
        <div class="group flex items-start gap-1 py-[3px]" :style="{ paddingLeft: `${depth * 22}px` }">
            <!-- 折叠三角 -->
            <button
                class="w-4 h-6 shrink-0 grid place-items-center text-faint hover:text-ink transition"
                :class="hasKids ? '' : 'opacity-0 pointer-events-none'"
                @click="store.toggleCollapse(id)"
            >
                <svg width="9" height="9" viewBox="0 0 10 10" class="transition-transform" :class="node.collapsed ? '' : 'rotate-90'"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <!-- bullet：点圆点 zoom -->
            <button
                class="w-4 h-6 shrink-0 grid place-items-center"
                title="聚焦"
                @click="emit('zoom', id)"
            >
                <span class="w-[7px] h-[7px] rounded-full transition" :class="node.collapsed ? 'bg-faint ring-4 ring-faint/20' : 'bg-muted group-hover:bg-ink'"></span>
            </button>
            <!-- 文本 -->
            <textarea
                ref="taRef"
                rows="1"
                class="flex-1 min-w-0 bg-transparent outline-none resize-none text-[14px] leading-6 text-ink py-0.5"
                :value="node.text"
                placeholder="…"
                @input="onInput"
                @keydown="onKeydown"
                @focus="focused = true"
                @blur="focused = false; flush()"
            ></textarea>
            <!-- 聚焦行操作 -->
            <div class="flex items-center gap-0.5 shrink-0 transition-opacity" :class="focused ? 'opacity-100' : 'opacity-0 pointer-events-none'">
                <button class="oa" title="反缩进" @mousedown.prevent="store.outdent(id)">⇤</button>
                <button class="oa" title="缩进" @mousedown.prevent="store.indent(id)">⇥</button>
                <button class="oa" title="上移" @mousedown.prevent="store.move(id, -1)">↑</button>
                <button class="oa" title="下移" @mousedown.prevent="store.move(id, 1)">↓</button>
                <button class="oa hover:text-bad" title="删除" @mousedown.prevent="store.remove(id)">🗑</button>
            </div>
        </div>
        <!-- 子节点 -->
        <template v-if="!node.collapsed">
            <OutlineNode v-for="c in kids" :key="c.id" :id="c.id" :depth="depth + 1" @zoom="emit('zoom', $event)" />
        </template>
    </div>
</template>

<style scoped>
.oa { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 6px; color: var(--muted); font-size: 13px; }
.oa:hover { background: var(--well); color: var(--ink); }
</style>
