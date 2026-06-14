<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useViewStore } from '@/system/stores/view';
import { useWsStore } from '@/system/stores/ws';

const props = defineProps({
    align: { type: String, default: 'right' },
});

const route = useRoute();
const router = useRouter();
const view = useViewStore();
const ws = useWsStore();
const open = ref(false);

function toggle() {
    open.value = !open.value;
}

function pick(path) {
    open.value = false;
    if (route.path !== path) router.push({ path, query: route.query });
}
</script>

<template>
    <div class="app-panel" :class="`align-${props.align}`">
        <button class="app-panel-btn" title="应用" @click.stop="toggle">
            <span class="app-panel-grid" aria-hidden="true">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
            </span>
        </button>

        <Teleport to="body">
            <div v-if="open" class="app-panel-mask" @click="open = false"></div>
            <transition name="app-panel-pop">
                <div v-if="open" class="app-panel-pop" :class="`align-${props.align}`">
                    <div class="app-panel-status">
                        <span class="app-panel-status-dot" :class="{ connected: ws.state === 'connected', pending: ws.state === 'pending' || ws.isReconnecting, offline: ws.connectionLost || ws.state === 'offline' }"></span>
                        <span>{{ ws.statusText }}</span>
                    </div>
                    <div class="app-panel-list">
                        <button
                            v-for="item in view.navItems"
                            :key="item.path"
                            class="app-panel-item"
                            :class="{ on: route.path === item.path }"
                            @click="pick(item.path)"
                        >
                            <span class="app-panel-emoji">{{ item.icon }}</span>
                            <span class="app-panel-name">{{ item.label }}</span>
                        </button>
                    </div>
                </div>
            </transition>
        </Teleport>
    </div>
</template>

<style scoped>
.app-panel {
    position: relative;
    flex-shrink: 0;
}
.app-panel-btn {
    position: relative;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-line);
    border-radius: 10px;
    background: var(--color-bg-elev);
    color: var(--color-ink);
    transition: border-color 0.12s ease, background 0.12s ease, transform 0.12s ease;
}
.app-panel-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-bg-hi);
}
.app-panel-btn:active { transform: scale(0.96); }
.app-panel-grid {
    display: grid;
    grid-template-columns: repeat(3, 3px);
    gap: 3px;
}
.app-panel-grid i {
    width: 3px;
    height: 3px;
    border-radius: 999px;
    background: currentColor;
}
.app-panel-status-dot.connected { background: var(--win); }
.app-panel-status-dot.pending { background: var(--fix); }
.app-panel-status-dot.offline { background: var(--bad); }
</style>

<style>
.app-panel-mask {
    position: fixed;
    inset: 0;
    z-index: 70;
}
.app-panel-pop {
    position: fixed;
    top: calc(58px + env(safe-area-inset-top, 0px));
    right: 12px;
    z-index: 71;
    width: min(318px, calc(100vw - 24px));
    padding: 10px;
    border: 1px solid var(--color-line);
    border-radius: 18px;
    background: var(--glass);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow: 0 22px 60px #00000030;
}
.app-panel-pop.align-left {
    right: auto;
    left: 12px;
}
.app-panel-status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 7px 8px 10px;
    color: var(--color-muted);
    font-size: 12px;
    font-weight: 650;
}
.app-panel-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    flex-shrink: 0;
}
.app-panel-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.app-panel-item {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding: 12px 4px 10px;
    border-radius: 14px;
    color: var(--color-muted);
    transition: background 0.12s ease, color 0.12s ease, transform 0.12s ease;
}
.app-panel-item:hover {
    background: var(--well);
    color: var(--color-ink);
}
.app-panel-item:active { transform: scale(0.98); }
.app-panel-item.on {
    background: var(--accent-soft);
    color: var(--accent-d);
}
.app-panel-emoji {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--color-line);
    border-radius: 13px;
    background: var(--color-bg-elev);
    font-size: 24px;
    line-height: 1;
}
.app-panel-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 750;
}
.app-panel-pop-enter-active,
.app-panel-pop-leave-active {
    transition: opacity 0.14s ease, transform 0.14s ease;
}
.app-panel-pop-enter-from,
.app-panel-pop-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
}
</style>
