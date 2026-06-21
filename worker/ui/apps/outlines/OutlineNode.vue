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

watch(() => store.focusWant, async (w) => { if (w === props.id) { await nextTick(); taRef.value?.focus(); store.focusWant = 0; } });
watch(() => node.value.text, () => nextTick(() => fit(taRef.value)));
</script>

<template>
    <div>
        <div class="group flex items-start gap-0.5 rounded-xl pr-1 transition-colors" :class="focused ? 'bg-bg-elev/70' : 'hover:bg-bg-elev/50'">
            <!-- 折叠 -->
            <button
                class="grid h-8 w-6 shrink-0 place-items-center text-faint transition active:scale-90"
                :class="{ invisible: !hasKids }" @click="store.toggleCollapse(id)"
            >
                <svg width="9" height="9" viewBox="0 0 10 10" class="transition-transform duration-150" :class="node.collapsed ? '' : 'rotate-90'">
                    <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
            <!-- 圆点(点聚焦) -->
            <button class="grid h-8 w-5 shrink-0 place-items-center" title="聚焦" @click="emit('zoom', id)">
                <span class="h-[7px] w-[7px] rounded-full transition" :class="node.collapsed ? 'bg-faint ring-[3.5px] ring-faint/15' : 'bg-faint group-hover:bg-accent'"></span>
            </button>
            <!-- 文本 -->
            <textarea
                ref="taRef" v-grow rows="1" :value="node.text" placeholder="未命名" spellcheck="false"
                class="min-w-0 flex-1 resize-none border-0 bg-transparent py-[7px] text-[14px] leading-[1.5] outline-none placeholder:text-faint"
                :class="node.done ? 'text-faint line-through' : 'text-ink'"
                @input="onInput" @keydown="onKey" @focus="focused = true" @blur="focused = false; flush()"
            ></textarea>
            <!-- 操作(聚焦/悬浮显示,移动端点文本即出) -->
            <div class="flex shrink-0 items-center self-center gap-0.5 transition-opacity" :class="focused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'">
                <button class="onode-act" :class="{ 'text-good': node.done }" title="完成" @mousedown.prevent="store.setDone(id, !node.done)">✓</button>
                <button class="onode-act" title="反缩进" @mousedown.prevent="store.outdent(id)">⇤</button>
                <button class="onode-act" title="缩进" @mousedown.prevent="store.indent(id)">⇥</button>
                <button class="onode-act hover:!text-bad" title="删除" @mousedown.prevent="store.remove(id)">✕</button>
            </div>
        </div>
        <!-- 子树:引导线 -->
        <div v-if="!node.collapsed && hasKids" class="ml-[14px] border-l border-line pl-0.5 sm:ml-[18px]">
            <OutlineNode v-for="c in kids" :key="c.id" :id="c.id" @zoom="emit('zoom', $event)" />
        </div>
    </div>
</template>

<style scoped>
.onode-act { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 7px; color: var(--color-faint); font-size: 12px; transition: background .12s, color .12s; }
.onode-act:hover { background: var(--color-bg-hi); color: var(--color-ink); }
</style>
