<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useViewStore } from '@/system/stores/view';
import { useWsStore } from '@/system/stores/ws';

// 设备内的左侧汉堡:切换该设备的应用(主页/文件/终端/屏幕)。
const route = useRoute();
const router = useRouter();
const view = useViewStore();
const ws = useWsStore();

const open = ref(false);
const btnRef = ref(null);
const popStyle = ref({});

function toggle() {
    if (!open.value && btnRef.value) {
        const r = btnRef.value.getBoundingClientRect();
        popStyle.value = { top: `${r.bottom + 8}px`, left: `${r.left}px` };
    }
    open.value = !open.value;
}
function pathFor(seg) { return `/devices/${route.params.id}/${seg}`; }
function go(seg) { open.value = false; const p = pathFor(seg); if (route.path !== p) router.push(p); }
</script>

<template>
    <div class="dn">
        <button ref="btnRef" class="dn-btn" title="设备应用" @click.stop="toggle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <Teleport to="body">
            <div v-if="open" class="dn-mask" @click="open = false"></div>
            <transition name="dn-pop">
                <div v-if="open" class="dn-pop" :style="popStyle">
                    <div class="dn-head">
                        <span class="dn-dot" :class="ws.currentDevice?.online ? 'on' : 'off'"></span>
                        {{ ws.currentDevice?.name || ws.currentDevice?.id || '未选设备' }}
                    </div>
                    <button
                        v-for="item in view.deviceNav" :key="item.seg"
                        class="dn-item" :class="{ on: route.path === pathFor(item.seg) }" @click="go(item.seg)"
                    >
                        <span class="dn-emoji">{{ item.icon }}</span>
                        <span>{{ item.label }}</span>
                    </button>
                </div>
            </transition>
        </Teleport>
    </div>
</template>

<style scoped>
.dn { flex-shrink: 0; }
.dn-btn {
    width: 36px; height: 36px; margin-left: -6px; display: grid; place-items: center;
    border-radius: 10px; color: var(--color-muted); transition: background .12s, color .12s;
}
.dn-btn:hover { background: var(--accent-soft); color: var(--color-ink); }
</style>

<style>
.dn-mask { position: fixed; inset: 0; z-index: 70; }
.dn-pop {
    position: fixed; z-index: 71; width: 220px; padding: 8px;
    border: 1px solid var(--color-line); border-radius: 16px; background: var(--glass);
    backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 22px 60px #00000030;
}
.dn-head { display: flex; align-items: center; gap: 8px; padding: 6px 8px 8px; color: var(--color-ink); font-size: 13px; font-weight: 800; }
.dn-dot { width: 8px; height: 8px; border-radius: 999px; }
.dn-dot.on { background: var(--win); }
.dn-dot.off { background: var(--color-faint); }
.dn-item {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 8px; border-radius: 10px;
    color: var(--color-muted); font-size: 13.5px; font-weight: 700; transition: background .12s, color .12s;
}
.dn-item:hover { background: var(--well); color: var(--color-ink); }
.dn-item.on { background: var(--accent-soft); color: var(--accent-d); }
.dn-emoji { width: 22px; text-align: center; font-size: 16px; }
.dn-pop-enter-active, .dn-pop-leave-active { transition: opacity .14s, transform .14s; }
.dn-pop-enter-from, .dn-pop-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }
</style>
