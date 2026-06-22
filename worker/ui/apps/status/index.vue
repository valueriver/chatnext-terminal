<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import ControlCenter from '@/system/components/ControlCenter.vue';
import DeviceOffline from '@/system/components/DeviceOffline.vue';

const ws = useWsStore();

const snap = ref(null);
const pending = new Map();
let seq = 0;
let timer = null;

const online = computed(() => ws.deviceOnline);

function request() {
    if (!ws.connected || !online.value) return;
    const reqId = `h${Date.now()}_${seq++}`;
    pending.set(reqId, 1);
    ws.sendMsg({ type: 'status.request', data: { reqId } });
}

function fmtBytes(n) {
    const b = Number(n) || 0;
    if (b >= 1 << 30) return `${(b / (1 << 30)).toFixed(1)} GB`;
    if (b >= 1 << 20) return `${Math.round(b / (1 << 20))} MB`;
    return `${Math.round(b / 1024)} KB`;
}
function fmtUptime(s) {
    const t = Number(s) || 0;
    const d = Math.floor(t / 86400); const h = Math.floor((t % 86400) / 3600); const m = Math.floor((t % 3600) / 60);
    return d ? `${d}天 ${h}时` : h ? `${h}时 ${m}分` : `${m}分`;
}

onMounted(() => {
    ws.onMessage('status.result', (msg) => {
        const d = msg.data || {};
        if (d.reqId && pending.has(d.reqId)) { pending.delete(d.reqId); if (d.ok) snap.value = d; }
    });
    request();
    timer = setInterval(request, 5000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
    <section class="view">
        <div class="head">
            <div class="head-title">
                <span class="dot" :class="online ? 'on' : 'off'"></span>
                状态
            </div>
            <ControlCenter />
        </div>

        <DeviceOffline v-if="!online" />
        <div v-else class="page-wrap">
            <div class="home">
                <!-- 连接状态 -->
                <div class="conn ok">
                    <span class="dot on"></span>
                    <span>设备在线,可操控 —— {{ ws.device.name || '设备' }}</span>
                </div>

                <!-- 本机状态卡片 -->
                <div v-if="snap" class="stats">
                    <div class="stat">
                        <div class="stat-k">CPU</div>
                        <div class="stat-v">{{ Math.round(snap.cpu?.usagePercent || 0) }}<i>%</i></div>
                        <div class="bar"><span :style="{ width: `${snap.cpu?.usagePercent || 0}%` }"></span></div>
                        <div class="stat-sub">{{ snap.cpu?.count }} 核</div>
                    </div>
                    <div class="stat">
                        <div class="stat-k">内存</div>
                        <div class="stat-v">{{ Math.round(snap.mem?.percent || 0) }}<i>%</i></div>
                        <div class="bar"><span :style="{ width: `${snap.mem?.percent || 0}%` }"></span></div>
                        <div class="stat-sub">{{ fmtBytes(snap.mem?.used) }} / {{ fmtBytes(snap.mem?.total) }}</div>
                    </div>
                    <div class="stat" v-if="snap.disk">
                        <div class="stat-k">磁盘</div>
                        <div class="stat-v">{{ Math.round(snap.disk?.percent || 0) }}<i>%</i></div>
                        <div class="bar"><span :style="{ width: `${snap.disk?.percent || 0}%` }"></span></div>
                        <div class="stat-sub">{{ fmtBytes(snap.disk?.used) }} / {{ fmtBytes(snap.disk?.total) }}</div>
                    </div>
                </div>
                <div v-if="snap" class="host">
                    {{ snap.host?.platform }} · {{ snap.host?.arch }} · 运行 {{ fmtUptime(snap.host?.uptime) }}
                </div>
                <div v-else class="host">读取本机状态…</div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.head { flex-shrink: 0; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--color-line); background: var(--color-bg); padding: 10px 12px; }
.head-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 850; color: var(--color-ink); }
.home { padding: 16px; display: flex; flex-direction: column; gap: 16px; max-width: 720px; margin: 0 auto; }
.dot { width: 9px; height: 9px; border-radius: 999px; flex-shrink: 0; }
.dot.on { background: var(--win); box-shadow: 0 0 8px color-mix(in srgb, var(--win) 60%, transparent); }
.dot.off { background: var(--color-faint); }
.conn { display: flex; align-items: center; gap: 9px; padding: 12px 14px; border-radius: 13px; font-size: 13px; font-weight: 650; border: 1px solid var(--color-line); }
.conn.ok { color: var(--color-ink); background: var(--color-bg-elev); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.stat { padding: 14px; border-radius: 14px; border: 1px solid var(--color-line); background: var(--color-bg-elev); }
.stat-k { color: var(--color-muted); font-size: 12px; font-weight: 700; }
.stat-v { color: var(--color-ink); font-size: 26px; font-weight: 850; line-height: 1.1; margin-top: 4px; }
.stat-v i { font-size: 14px; font-weight: 700; color: var(--color-muted); font-style: normal; margin-left: 1px; }
.bar { height: 5px; border-radius: 999px; background: var(--well); margin: 8px 0 6px; overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--color-accent); border-radius: 999px; }
.stat-sub { color: var(--color-faint); font-size: 11px; }
.host { color: var(--color-faint); font-size: 12px; text-align: center; }
@media (max-width: 560px) { .stats { grid-template-columns: repeat(2, 1fr); } }
</style>
