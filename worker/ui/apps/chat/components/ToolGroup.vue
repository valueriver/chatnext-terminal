<script setup>
import { fmtArgs, toolLabel, toolSubtitle } from '@/apps/chat/lib/format';

defineProps({
    items: { type: Array, required: true },
});
</script>

<template>
    <div class="mrow tool-row">
        <div class="avatar ghost">AI</div>
        <div class="tool-group">
            <div
                v-for="item in items"
                :key="item._key"
                class="tool-item"
                :class="{ open: item.expanded }"
            >
                <div class="tool-head" @click="item.expanded = !item.expanded">
                    <span class="tool-caret">{{ item.expanded ? '▾' : '▸' }}</span>
                    <span class="tool-title">
                        {{ toolLabel(item.name) }}
                        <template v-if="toolSubtitle(item)"> · {{ toolSubtitle(item) }}</template>
                    </span>
                    <span class="pill" :class="item.status === 'running' ? 'run' : 'done'">
                        {{ item.status === 'running' ? '执行中' : '完成' }}
                    </span>
                </div>
                <div v-if="item.expanded" class="tool-body">参数：{{ fmtArgs(item.args) }}<template v-if="item.result">

结果：
{{ item.result }}</template></div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.tool-row { align-items: flex-start; }
.tool-group {
    width: min(82%, 620px);
    min-width: 0;
    background: var(--panel);
    border-radius: 16px;
    border-bottom-left-radius: 6px;
    box-shadow: 0 6px 20px #0000000d;
    overflow: hidden;
}
.tool-item + .tool-item { border-top: 1px solid var(--line); }
.tool-item.open + .tool-item { border-top-color: var(--line2); }
@media (max-width: 640px) {
    .tool-group { width: 92%; }
}
</style>
