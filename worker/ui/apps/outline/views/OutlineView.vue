<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useOutlineStore } from '@/apps/outline/store';
import { useWsStore } from '@/system/stores/ws';
import AppPanel from '@/system/components/AppPanel.vue';
import OutlineNode from '@/apps/outline/OutlineNode.vue';

const store = useOutlineStore();
const ws = useWsStore();
const rootId = ref(0); // 0 = 顶层；zoom 后为某节点 id

const roots = computed(() => store.children(rootId.value));
const rootNode = computed(() => (rootId.value ? store.node(rootId.value) : null));
const crumbs = computed(() => (rootId.value ? store.ancestors(rootId.value) : []));

function zoom(id) { rootId.value = id; }
function unzoom(id) { rootId.value = id || 0; }
async function addRoot() {
    await store.create({ parentId: rootId.value || 0 });
}

async function load() { if (ws.canUseActions) await store.load(); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
// zoom 目标被删后回顶层
watch(() => store.items, () => { if (rootId.value && !store.node(rootId.value)) rootId.value = 0; });
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink">大纲</div>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <p class="text-muted text-[12.5px] leading-relaxed mx-1.5 mb-3">整理你的内心图景。回车新建、Tab 缩进，点圆点聚焦，三角折叠。聚焦某行时右侧有缩进/移动/删除。</p>

                <!-- 面包屑（zoom 时） -->
                <div v-if="rootId" class="flex items-center flex-wrap gap-1 text-[12.5px] text-muted mb-2 px-1">
                    <button class="hover:text-ink" @click="unzoom(0)">首页</button>
                    <template v-for="c in crumbs" :key="c.id">
                        <span class="text-faint">›</span>
                        <button class="hover:text-ink truncate max-w-[160px]" @click="unzoom(c.id)">{{ c.text || '（空）' }}</button>
                    </template>
                </div>
                <div v-if="rootNode" class="text-[20px] font-extrabold text-ink mb-1 px-1 break-words">{{ rootNode.text || '（空）' }}</div>

                <!-- 树 -->
                <div class="-ml-1">
                    <OutlineNode v-for="n in roots" :key="n.id" :id="n.id" :depth="0" @zoom="zoom" />
                </div>

                <button
                    class="mt-1 ml-7 text-[13.5px] text-faint hover:text-accent transition"
                    :disabled="!ws.canUseActions"
                    @click="addRoot"
                >＋ 新增一项</button>

                <div v-if="!roots.length" class="text-muted text-[13px] text-center py-10">
                    {{ ws.canUseActions ? '空白的画布。点「＋ 新增一项」开始。' : '未连接本机 Server，无法读取大纲。' }}
                </div>
            </div>
        </div>
    </section>
</template>
