<script setup>
import ControlCenter from '@/system/components/ControlCenter.vue';
</script>

<template>
    <div class="settings-bar">
        <div class="settings-title">设置</div>
        <ControlCenter />
    </div>
</template>

<style scoped>
.settings-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: calc(10px + env(safe-area-inset-top, 0px)) 16px 4px;
}
.settings-title {
    flex: 1;
    min-width: 0;
    color: var(--ink);
    font-size: 15px;
    font-weight: 850;
}
</style>
