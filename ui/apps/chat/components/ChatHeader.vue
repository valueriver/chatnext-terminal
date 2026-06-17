<script setup>
import AppPanel from '@/system/components/AppPanel.vue';

defineProps({
    title: { type: String, default: '对话' },
    historyOpen: { type: Boolean, default: false },
});

const emit = defineEmits(['toggleHistory']);
</script>

<template>
    <div class="chat-head">
        <button class="cbtn" :class="{ on: historyOpen }" title="历史对话" @click="emit('toggleHistory')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="chat-title">{{ title || '对话' }}</div>
        <AppPanel />
    </div>
</template>

<style scoped>
.chat-head {
    position: relative;
    z-index: 60;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--color-line);
    background: var(--color-bg);
    padding: 10px 12px;
}
.chat-title {
    flex: 1;
    min-width: 0;
    color: var(--color-ink);
    font-size: 15px;
    font-weight: 850;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.cbtn {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-line);
    background: var(--color-bg-elev);
    color: var(--color-muted);
    transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}
.cbtn:hover,
.cbtn.on {
    border-color: var(--color-accent);
    background: var(--accent-soft);
    color: var(--accent-d);
}
</style>
