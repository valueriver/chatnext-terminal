<script setup>
// 任务详情：状态 / 提示 / 执行过程 / 结果。tasks 与 schedule 共用。
import { renderMd } from '@/apps/chat/lib/format';
import { pill, isActive, fmtTime, argsOf } from '@/apps/tasks/lib';

const props = defineProps({
    task: { type: Object, required: true },
    messages: { type: Array, default: () => [] },
});
const emit = defineEmits(['abort']);
</script>

<template>
    <div>
        <div class="flex items-center gap-2 mb-3">
            <span class="text-[11px] font-bold rounded-full px-2 py-0.5" :class="pill(task.status).cls">{{ pill(task.status).label }}</span>
            <span class="text-faint text-[11px]">{{ fmtTime(task.created_at) }}</span>
            <span class="flex-1"></span>
            <button v-if="isActive(task.status)" class="text-bad text-[12px] font-bold" @click="emit('abort', task.id)">中止</button>
        </div>

        <div class="text-muted text-[11px] font-bold tracking-wider mb-1.5">提示</div>
        <div class="rounded-[13px] bg-bg-elev border border-line px-3.5 py-3 text-[13.5px] text-ink whitespace-pre-wrap break-words mb-5">{{ task.prompt }}</div>

        <div v-if="messages.some(m => m.role === 'tool' || m.tool_calls)" class="text-muted text-[11px] font-bold tracking-wider mb-1.5">执行过程</div>
        <div class="flex flex-col gap-2 mb-5">
            <template v-for="m in messages" :key="m.id">
                <div v-if="m.tool_calls" v-for="(tc, i) in m.tool_calls" :key="m.id + '-' + i" class="rounded-[10px] bg-bg-hi border border-line px-3 py-2">
                    <div class="text-[12px] font-bold text-accent-hi">🔧 {{ tc.function?.name }}</div>
                    <pre class="text-[11px] text-muted mt-1 whitespace-pre-wrap break-words font-mono">{{ JSON.stringify(argsOf(tc)) }}</pre>
                </div>
                <div v-else-if="m.role === 'tool'" class="rounded-[10px] bg-bg-elev border border-line px-3 py-2 text-[11px] text-muted font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{{ m.content }}</div>
            </template>
        </div>

        <template v-if="task.status === 'done'">
            <div class="text-muted text-[11px] font-bold tracking-wider mb-1.5">结果</div>
            <div class="rounded-[13px] bg-bg-elev border border-line px-4 py-3"><div class="md" v-html="renderMd(task.response || '（空）')"></div></div>
        </template>
        <div v-else-if="task.status === 'error'" class="rounded-[13px] bg-bad/12 border border-bad/40 px-3.5 py-3 text-[13px] text-bad whitespace-pre-wrap">{{ task.error }}</div>
        <div v-else-if="isActive(task.status)" class="text-muted text-[13px] py-2">运行中…</div>
    </div>
</template>
