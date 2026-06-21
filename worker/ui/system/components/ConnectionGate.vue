<script setup>
import { computed } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import { useRoute } from 'vue-router';

const ws = useWsStore();
const route = useRoute();

// guard 页自己显示状态;其余页面在未连上时盖一层。
const show = computed(() => route.name !== 'guard' && !ws.connected);
</script>

<template>
    <Transition name="gate-fade">
        <div v-if="show"
            class="fixed inset-0 z-30 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
            <div class="flex flex-col items-center gap-3">
                <div class="font-serif font-black text-[28px] leading-none tracking-tight text-ink">
                    One<span class="text-accent">.</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="gate-dot" :data-state="ws.state"></span>
                    <span class="text-xs text-muted">{{ ws.statusText }}</span>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.gate-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--color-faint);
    display: inline-block;
}
.gate-dot[data-state="pending"] { background: var(--color-accent); animation: gate-pulse 1.4s ease-in-out infinite; }
.gate-dot[data-state="offline"] { background: var(--color-bad); }

@keyframes gate-pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.35; }
}

.gate-fade-enter-active, .gate-fade-leave-active { transition: opacity .18s ease; }
.gate-fade-enter-from, .gate-fade-leave-to { opacity: 0; }
</style>
