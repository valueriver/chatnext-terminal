<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useOutlineStore } from '@/apps/outlines/store';
import ControlCenter from '@/system/components/ControlCenter.vue';
import MindMap from '@/apps/outlines/MindMap.vue';

const store = useOutlineStore();
const rootId = ref(0);               // 0 = 全部(虚拟根);聚焦后为某节点

const crumbs = computed(() => {
    const head = [{ id: 0, text: '全部' }];
    if (!rootId.value) return head;
    return [...head, ...store.ancestors(rootId.value), store.node(rootId.value)].filter(Boolean);
});

function zoom(id) { rootId.value = id; }
function addRoot() { store.create({ parentId: rootId.value || 0 }); }

onMounted(store.load);
watch(() => store.items, () => { if (rootId.value && !store.node(rootId.value)) rootId.value = 0; });

const empty = computed(() => store.children(rootId.value).length === 0);
</script>

<template>
    <section class="view">
        <header class="flex shrink-0 items-center gap-3 px-6 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-3">
            <h1 class="font-serif text-xl font-black tracking-tight text-ink">导图</h1>
            <ControlCenter class="ml-auto" />
        </header>

        <!-- 面包屑(聚焦时) -->
        <div v-if="rootId" class="flex shrink-0 flex-wrap items-center gap-1 px-6 pb-2">
            <template v-for="(c, i) in crumbs" :key="c.id">
                <span v-if="i > 0" class="text-[10px] text-[var(--line2)]">›</span>
                <button
                    class="rounded-full px-2.5 py-1 text-[11.5px] font-bold transition"
                    :class="i === crumbs.length - 1 ? 'text-ink' : 'text-muted hover:bg-accent/10 hover:text-accent'"
                    @click="zoom(c.id)"
                >{{ c.text || '未命名' }}</button>
            </template>
        </div>

        <div class="relative flex-1 overflow-hidden">
            <MindMap :root-id="rootId" @zoom="zoom" />

            <!-- 空状态 -->
            <div v-if="empty" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div class="font-serif text-[24px] font-black text-faint">从一个想法开始</div>
                <p class="mt-2 text-[13px] text-muted">把总思路铺开 · Tab 加子节点 · 回车加同级 · 双击聚焦</p>
                <button class="pointer-events-auto mt-4 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-white shadow" @click="addRoot">新建一个节点</button>
            </div>
        </div>
    </section>
</template>
