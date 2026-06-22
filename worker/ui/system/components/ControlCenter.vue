<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useViewStore } from '@/system/stores/view';
import { useWsStore } from '@/system/stores/ws';

const props = defineProps({ align: { type: String, default: 'right' } });

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
        const gap = 8;
        popStyle.value = props.align === 'left'
            ? { top: `${r.bottom + gap}px`, left: `${r.left}px` }
            : { top: `${r.bottom + gap}px`, right: `${window.innerWidth - r.right}px` };
    }
    open.value = !open.value;
}

function go(path) { open.value = false; if (route.path !== path) router.push(path); }
</script>

<template>
    <div class="cc" :class="`align-${props.align}`">
        <button ref="btnRef" class="cc-btn" title="应用" @click.stop="toggle">
            <span class="cc-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </button>

        <Teleport to="body">
            <div v-if="open" class="cc-mask" @click="open = false"></div>
            <transition name="cc-pop">
                <div v-if="open" class="cc-pop" :style="popStyle">
                    <div class="cc-cloud">
                        <button
                            v-for="item in view.apps" :key="item.path"
                            class="cc-app" :class="{ on: route.path === item.path }" @click="go(item.path)"
                        >
                            <span class="cc-emoji">
                                {{ item.icon }}
                                <span v-if="item.needsDevice && !ws.deviceOnline" class="cc-off" title="设备未连接"></span>
                            </span>
                            <span class="cc-name">{{ item.label }}</span>
                        </button>
                    </div>

                    <!-- 设备状态(点进状态页管理) -->
                    <button class="cc-dev-row" @click="go('/status')">
                        <span class="cc-dot" :class="ws.deviceOnline ? 'on' : 'off'"></span>
                        <span class="cc-dev-txt">{{ ws.deviceOnline ? `设备在线 · ${ws.device.name || '设备'}` : (ws.device.paired ? '设备离线' : '未连接设备') }}</span>
                        <span class="cc-dev-go">›</span>
                    </button>
                </div>
            </transition>
        </Teleport>
    </div>
</template>

<style scoped>
.cc { position: relative; flex-shrink: 0; }
.cc-btn {
    display: grid; place-items: center; width: 36px; height: 36px;
    border: 1px solid var(--color-line); border-radius: 10px; background: var(--color-bg-elev);
    color: var(--color-ink); transition: border-color .12s, background .12s, transform .12s;
}
.cc-btn:hover { border-color: var(--color-accent); background: var(--color-bg-hi); }
.cc-btn:active { transform: scale(.96); }
.cc-grid { display: grid; grid-template-columns: repeat(3, 3px); gap: 3px; }
.cc-grid i { width: 3px; height: 3px; border-radius: 999px; background: currentColor; }
</style>

<style>
.cc-mask { position: fixed; inset: 0; z-index: 70; }
.cc-pop {
    position: fixed; z-index: 71; width: min(312px, calc(100vw - 24px)); padding: 12px;
    border: 1px solid var(--color-line); border-radius: 22px; background: var(--glass);
    backdrop-filter: blur(22px) saturate(1.4); -webkit-backdrop-filter: blur(22px) saturate(1.4);
    box-shadow: 0 1px 0 #ffffff30 inset, 0 18px 50px #0000002e;
}
.cc-cloud { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.cc-app {
    display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 0;
    padding: 11px 2px 9px; border-radius: 16px; color: var(--color-muted);
    transition: background .14s, color .14s, transform .12s;
}
.cc-app:hover { color: var(--color-ink); }
.cc-app:hover .cc-emoji { transform: translateY(-1px); box-shadow: 0 6px 16px #00000018; }
.cc-app:active { transform: scale(.96); }
.cc-app.on { color: var(--accent-d); }
.cc-app.on .cc-emoji { background: var(--accent-soft); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent); }
.cc-emoji {
    position: relative;
    display: grid; place-items: center; width: 46px; height: 46px; border-radius: 15px;
    background: var(--color-bg-elev); font-size: 23px; line-height: 1;
    box-shadow: 0 1px 0 #ffffff40 inset, 0 2px 6px #0000000f; transition: transform .14s, box-shadow .14s, background .14s;
}
.cc-off { position: absolute; top: 4px; right: 4px; width: 7px; height: 7px; border-radius: 999px; background: var(--color-faint); box-shadow: 0 0 0 2px var(--color-bg-elev); }
.cc-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 700; }
.cc-dev-row {
    display: flex; align-items: center; gap: 9px; width: 100%; margin-top: 10px; padding: 10px 12px;
    border-radius: 14px; border: 1px solid var(--color-line); background: var(--color-bg-elev);
    color: var(--color-ink); font-size: 12.5px; font-weight: 700; transition: border-color .14s, background .14s;
}
.cc-dev-row:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: var(--color-bg-hi); }
.cc-dev-txt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.cc-dev-go { color: var(--color-faint); font-size: 16px; }
.cc-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
.cc-dot.on { background: var(--win); box-shadow: 0 0 8px color-mix(in srgb, var(--win) 60%, transparent); }
.cc-dot.off { background: var(--color-faint); }
.cc-pop-enter-active, .cc-pop-leave-active { transition: opacity .14s, transform .14s; }
.cc-pop-enter-from, .cc-pop-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }
</style>
