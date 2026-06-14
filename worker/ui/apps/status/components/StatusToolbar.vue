<script setup>
import AppPanel from '@/system/components/AppPanel.vue';

defineProps({
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    error: { type: String, default: '' },
    capturedText: { type: String, default: '尚未获取' },
});

const emit = defineEmits(['refresh']);
</script>

<template>
    <div class="shrink-0 border-b border-zinc-800 bg-zinc-900/70">
        <div class="flex min-w-0 items-center gap-3 px-3 py-2">
            <div class="status-app-title min-w-0 flex-1">状态</div>
            <AppPanel />
        </div>
        <div class="flex items-center gap-2 border-t border-zinc-800 px-3 py-2">
            <button
                @click="emit('refresh')"
                :disabled="loading || disabled"
                class="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 transition-colors hover:bg-zinc-700 active:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                title="立即刷新">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
                    <path d="M3 21v-5h5" />
                    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
                    <path d="M21 3v5h-5" />
                </svg>
                <span>{{ loading ? '获取中' : '刷新' }}</span>
            </button>
            <div class="min-w-0 flex-1 text-right text-xs text-zinc-500">
                <span v-if="error" class="text-rose-300">{{ error }}</span>
                <span v-else>每 5 秒自动刷新</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.status-app-title {
    color: var(--color-ink);
    font-size: 15px;
    font-weight: 850;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
