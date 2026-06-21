<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useOutlineStore } from '@/apps/outlines/store';
import ControlCenter from '@/system/components/ControlCenter.vue';
import OutlineNode from '@/apps/outlines/OutlineNode.vue';

const store = useOutlineStore();
const rootId = ref(0);               // 0 = 全部;zoom 后聚焦某节点
const scroller = ref(null);

const roots = computed(() => store.children(rootId.value));
const current = computed(() => (rootId.value ? store.node(rootId.value) : null));
const crumbs = computed(() => {
    const head = [{ id: 0, text: '全部' }];
    if (!rootId.value) return head;
    return [...head, ...store.ancestors(rootId.value), store.node(rootId.value)].filter(Boolean);
});

function zoom(id) { rootId.value = id; }
function addRoot() { store.create({ parentId: rootId.value || 0 }); } // 焦点由 OutlineNode 的 focusWant 处理

onMounted(store.load);
watch(() => store.items, () => { if (rootId.value && !store.node(rootId.value)) rootId.value = 0; });
</script>

<template>
    <section class="view">
        <header class="flex shrink-0 items-center gap-3 px-6 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-3">
            <h1 class="font-serif text-xl font-black tracking-tight text-ink">大纲</h1>
            <ControlCenter class="ml-auto" />
        </header>

        <!-- 面包屑(聚焦时) -->
        <div v-if="rootId" class="mx-auto flex w-full max-w-[768px] shrink-0 flex-wrap items-center gap-1 px-6 pb-2">
            <template v-for="(c, i) in crumbs" :key="c.id">
                <span v-if="i > 0" class="text-[10px] text-[var(--line2)]">›</span>
                <button
                    class="rounded-full px-2.5 py-1 text-[11.5px] font-bold transition"
                    :class="i === crumbs.length - 1 ? 'text-ink' : 'text-muted hover:bg-accent/10 hover:text-accent'"
                    @click="zoom(c.id)"
                >{{ c.text || '未命名' }}</button>
            </template>
        </div>

        <div ref="scroller" class="flex-1 overflow-y-auto px-5 pb-20 sm:px-6">
            <div class="mx-auto max-w-[720px]">
                <h2 v-if="current" class="mb-3 px-1 font-serif text-[22px] font-extrabold tracking-tight text-ink">{{ current.text || '未命名' }}</h2>

                <div class="o-card">
                    <OutlineNode v-for="n in roots" :key="n.id" :id="n.id" @zoom="zoom" />

                    <button class="o-add" @click="addRoot">
                        <span class="o-add-plus">+</span>新增一项
                    </button>
                </div>

                <div v-if="!roots.length" class="select-none pt-16 text-center">
                    <div class="font-serif text-[24px] font-black text-faint">从一个想法开始</div>
                    <p class="mt-2 text-[13px] text-muted">回车建同级 · Tab 缩进 · 点圆点聚焦</p>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.o-card {
    background: var(--panel);
    border-radius: 22px;
    box-shadow: 0 6px 20px #0000000d;
    padding: 10px 12px;
}
.o-add {
    display: flex; align-items: center; gap: 8px;
    margin-top: 2px; padding: 7px 8px; border-radius: 10px;
    font-size: 13px; font-weight: 600; color: var(--faint);
    transition: background .12s, color .12s;
}
.o-add:hover { background: var(--accent-soft); color: var(--accent-d); }
.o-add-plus { display: grid; place-items: center; height: 20px; width: 20px; border-radius: 7px; background: var(--well); font-size: 15px; line-height: 1; }
</style>
