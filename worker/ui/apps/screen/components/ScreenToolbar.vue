<script setup>
import ControlCenter from '@/system/components/ControlCenter.vue';

defineProps({
    canCapture: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    capturedText: { type: String, default: '尚未截图' },
    sizeText: { type: String, default: '' },
});

const emit = defineEmits(['capture']);
</script>

<template>
    <div class="shrink-0 border-b border-line bg-bg-elev/70">
        <div class="flex min-w-0 items-center gap-3 px-3 py-2">
            <div class="screen-app-title min-w-0 flex-1">屏幕</div>
            <ControlCenter />
        </div>
        <div class="flex min-w-0 items-center gap-2 border-t border-line px-3 py-2">
            <button
                v-show="canCapture"
                @click="emit('capture')"
                :disabled="loading"
                class="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded border border-line-hi bg-bg-hi px-3 text-sm text-ink transition-colors hover:bg-bg-hi active:bg-bg-hi disabled:cursor-not-allowed disabled:opacity-60"
                title="刷新截图">
                <svg class="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
                    <path d="M3 21v-5h5" />
                    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
                    <path d="M21 3v5h-5" />
                </svg>
                <span>{{ loading ? '截图中' : '刷新' }}</span>
            </button>

            <div class="min-w-0 flex-1 text-right text-xs text-muted">
                <div class="truncate">{{ capturedText }}</div>
                <div v-if="sizeText" class="truncate font-mono">{{ sizeText }}</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.screen-app-title {
    color: var(--color-ink);
    font-size: 15px;
    font-weight: 850;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
