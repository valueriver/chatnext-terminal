<script setup>
import { computed, onMounted, ref } from 'vue';
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
const showAdd = ref(false);
const origin = location.origin;

onMounted(() => view.load());

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
function enterDevice(d) {
    if (!d.online) return;
    open.value = false;
    router.push(`/devices/${d.id}/home`); // 进入设备主页(id 编进路由)
}
</script>

<template>
    <div class="cc" :class="`align-${props.align}`">
        <button ref="btnRef" class="cc-btn" title="中控台" @click.stop="toggle">
            <span class="cc-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </button>

        <Teleport to="body">
            <div v-if="open" class="cc-mask" @click="open = false"></div>
            <transition name="cc-pop">
                <div v-if="open" class="cc-pop" :style="popStyle">
                    <!-- 第一组:云端应用 -->
                    <div class="cc-cloud">
                        <button
                            v-for="item in view.cloudItems" :key="item.path"
                            class="cc-app" :class="{ on: route.path === item.path }" @click="go(item.path)"
                        >
                            <span class="cc-emoji">{{ item.icon }}</span>
                            <span class="cc-name">{{ item.label }}</span>
                        </button>
                    </div>

                    <!-- 第二组:设备(卡片,点进入该设备) -->
                    <div class="cc-label"><span>设备</span><span v-if="ws.devices.length" class="cc-label-n">{{ ws.devices.length }}</span></div>
                    <div class="cc-devs">
                        <button
                            v-for="d in ws.devices" :key="d.id"
                            class="cc-dev" :class="{ off: !d.online }" @click="enterDevice(d)"
                        >
                            <span class="cc-dev-av">💻</span>
                            <span class="cc-dev-name">{{ d.name || d.id }}</span>
                            <span class="cc-dev-pill" :class="d.online ? 'on' : 'off'">
                                <span class="cc-dot" :class="d.online ? 'on' : 'off'"></span>{{ d.online ? '在线' : '离线' }}
                            </span>
                        </button>
                        <div v-if="!ws.devices.length" class="cc-empty">还没有设备</div>
                        <button class="cc-add" @click="showAdd = true"><span class="cc-add-ic">+</span> 添加设备</button>
                    </div>
                </div>
            </transition>

            <!-- 添加设备说明 -->
            <div v-if="showAdd" class="cc-mask" style="z-index:80" @click="showAdd = false"></div>
            <div v-if="showAdd" class="cc-add-modal">
                <div class="cc-add-title">添加一台设备</div>
                <p>在那台电脑上,把 One 的 <code>computer/</code> 跑起来,连到本账户:</p>
                <ol>
                    <li>克隆仓库,复制 <code>computer/config.example.js</code> 为 <code>config.js</code></li>
                    <li>填 <code>WORKER_URL</code> = <code>{{ origin }}</code>,设一个 <code>DEVICE_SECRET</code></li>
                    <li>运行 <code>node computer/index.js</code></li>
                </ol>
                <p class="cc-add-note">起来后它会自动出现在上面的设备列表里。</p>
                <button class="cc-add-ok" @click="showAdd = false">知道了</button>
            </div>
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
.cc-cloud { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
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
    display: grid; place-items: center; width: 46px; height: 46px; border-radius: 15px;
    background: var(--color-bg-elev); font-size: 23px; line-height: 1;
    box-shadow: 0 1px 0 #ffffff40 inset, 0 2px 6px #0000000f; transition: transform .14s, box-shadow .14s, background .14s;
}
.cc-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 700; }
.cc-label { display: flex; align-items: center; gap: 6px; padding: 13px 8px 7px; color: var(--color-faint); font-size: 11px; font-weight: 800; letter-spacing: .08em; }
.cc-label-n { display: grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: var(--well); font-size: 10px; letter-spacing: 0; }
.cc-devs { display: flex; flex-direction: column; gap: 6px; }
.cc-dev {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 11px; border-radius: 14px;
    border: 1px solid var(--color-line); background: var(--color-bg-elev); color: var(--color-ink);
    font-size: 13px; font-weight: 700; transition: border-color .14s, background .14s, transform .12s;
}
.cc-dev:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); transform: translateY(-1px); box-shadow: 0 6px 16px #00000014; }
.cc-dev:active { transform: scale(.99); }
.cc-dev.off { opacity: .5; }
.cc-dev-av { display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0; border-radius: 10px; background: var(--accent-soft); font-size: 16px; }
.cc-dev-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.cc-dev-pill { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; padding: 3px 8px 3px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 700; }
.cc-dev-pill.on { background: var(--win-soft); color: var(--win); }
.cc-dev-pill.off { background: var(--well); color: var(--color-faint); }
.cc-dot { width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; }
.cc-dot.on { background: var(--win); }
.cc-dot.off { background: var(--color-faint); }
.cc-empty { color: var(--color-faint); font-size: 12px; padding: 4px 6px; }
.cc-add { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 12px; border-radius: 14px; border: 1px dashed var(--color-line-hi); color: var(--color-muted); font-size: 12.5px; font-weight: 700; transition: .12s; }
.cc-add:hover { color: var(--color-accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); background: var(--accent-soft); }
.cc-add-ic { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; background: var(--well); font-size: 14px; line-height: 1; }
.cc-back { color: var(--color-muted); font-size: 12px; font-weight: 700; padding: 2px 4px 8px; }
.cc-back:hover { color: var(--color-ink); }
.cc-dev-head { display: flex; align-items: center; gap: 8px; padding: 2px 6px 10px; color: var(--color-ink); font-size: 14px; font-weight: 800; }
.cc-add-modal {
    position: fixed; z-index: 81; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(380px, calc(100vw - 32px)); padding: 18px; border-radius: 18px;
    border: 1px solid var(--color-line); background: var(--color-bg); box-shadow: 0 24px 70px #00000040;
    color: var(--color-ink); font-size: 13px; line-height: 1.7;
}
.cc-add-title { font-size: 16px; font-weight: 850; margin-bottom: 8px; }
.cc-add-modal ol { padding-left: 18px; display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
.cc-add-modal code { background: var(--color-bg-elev); border: 1px solid var(--color-line); border-radius: 5px; padding: 1px 5px; font-size: 12px; }
.cc-add-note { color: var(--color-muted); }
.cc-add-ok { margin-top: 12px; width: 100%; height: 40px; border-radius: 10px; background: var(--color-accent); color: var(--color-bg); font-weight: 700; }
.cc-pop-enter-active, .cc-pop-leave-active { transition: opacity .14s, transform .14s; }
.cc-pop-enter-from, .cc-pop-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }
</style>
