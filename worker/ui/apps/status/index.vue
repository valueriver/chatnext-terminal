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
const d = computed(() => snap.value);

function request() {
    if (!ws.connected || !online.value) return;
    const reqId = `h${Date.now()}_${seq++}`;
    pending.set(reqId, 1);
    ws.sendMsg({ type: 'status.request', data: { reqId } });
}

function fmtBytes(n) {
    if (!Number.isFinite(Number(n)) || n <= 0) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = Number(n), i = 0;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 1)} ${u[i]}`;
}
function fmtUptime(s) {
    const t = Number(s) || 0;
    const dd = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60);
    const p = [];
    if (dd) p.push(`${dd}天`);
    if (h) p.push(`${h}小时`);
    if (m || (!dd && !h)) p.push(`${m}分`);
    return p.join(' ');
}
const pct = (n) => Math.round((Number(n) || 0) * 10) / 10;
function barClass(p) { return p < 60 ? 'lv-ok' : p < 85 ? 'lv-warn' : 'lv-bad'; }

onMounted(() => {
    ws.onMessage('status.result', (msg) => {
        const m = msg.data || {};
        if (m.reqId && pending.has(m.reqId)) { pending.delete(m.reqId); if (m.ok) snap.value = m; }
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
            <div class="wrap">
                <div class="conn">
                    <span class="dot on"></span>
                    <span class="conn-name">{{ ws.device.name || '设备' }}</span>
                    <span class="conn-tag">在线</span>
                </div>

                <div v-if="!d" class="loading">读取本机状态…</div>

                <template v-else>
                    <!-- 三大指标 -->
                    <div class="metrics">
                        <!-- CPU -->
                        <div class="metric">
                            <div class="m-top"><span class="m-k">CPU</span><span class="m-v">{{ pct(d.cpu?.usagePercent) }}<i>%</i></span></div>
                            <div class="bar"><span :class="barClass(pct(d.cpu?.usagePercent))" :style="{ width: `${Math.min(100, pct(d.cpu?.usagePercent))}%` }"></span></div>
                            <dl class="m-rows">
                                <dt>核心</dt><dd>{{ d.cpu?.count }} 核</dd>
                                <dt>主频</dt><dd>{{ d.cpu?.speed ? (d.cpu.speed / 1000).toFixed(2) + ' GHz' : '—' }}</dd>
                                <dt>负载</dt><dd class="mono">{{ (d.cpu?.loadavg || []).map(n => n.toFixed(2)).join(' / ') || '—' }}</dd>
                                <dt>型号</dt><dd class="ellip" :title="d.cpu?.model">{{ d.cpu?.model || '—' }}</dd>
                            </dl>
                        </div>

                        <!-- 内存 -->
                        <div class="metric">
                            <div class="m-top"><span class="m-k">内存</span><span class="m-v">{{ pct(d.mem?.percent) }}<i>%</i></span></div>
                            <div class="bar"><span :class="barClass(pct(d.mem?.percent))" :style="{ width: `${Math.min(100, pct(d.mem?.percent))}%` }"></span></div>
                            <dl class="m-rows">
                                <dt>已用</dt><dd class="mono">{{ fmtBytes(d.mem?.used) }}</dd>
                                <dt>总量</dt><dd class="mono">{{ fmtBytes(d.mem?.total) }}</dd>
                                <dt>空闲</dt><dd class="mono">{{ fmtBytes(d.mem?.free) }}</dd>
                            </dl>
                        </div>

                        <!-- 磁盘 -->
                        <div class="metric" v-if="d.disk">
                            <div class="m-top"><span class="m-k">磁盘 <em>{{ d.disk.mount }}</em></span><span class="m-v">{{ pct(d.disk.percent) }}<i>%</i></span></div>
                            <div class="bar"><span :class="barClass(pct(d.disk.percent))" :style="{ width: `${Math.min(100, pct(d.disk.percent))}%` }"></span></div>
                            <dl class="m-rows">
                                <dt>已用</dt><dd class="mono">{{ fmtBytes(d.disk.used) }}</dd>
                                <dt>总量</dt><dd class="mono">{{ fmtBytes(d.disk.total) }}</dd>
                                <dt>可用</dt><dd class="mono">{{ fmtBytes(d.disk.free) }}</dd>
                            </dl>
                        </div>
                    </div>

                    <!-- 主机 -->
                    <div class="card">
                        <div class="c-title">主机</div>
                        <dl class="c-rows">
                            <dt>主机名</dt><dd class="ellip">{{ d.host?.hostname }}</dd>
                            <dt>系统</dt><dd>{{ d.host?.platform }} {{ d.host?.release }}</dd>
                            <dt>架构</dt><dd>{{ d.host?.arch }}</dd>
                            <dt>运行时长</dt><dd>{{ fmtUptime(d.host?.uptime) }}</dd>
                        </dl>
                    </div>

                    <!-- 网络 -->
                    <div class="card" v-if="d.network?.length">
                        <div class="c-title">网络</div>
                        <ul class="net">
                            <li v-for="ifc in d.network" :key="ifc.name + ifc.address">
                                <span class="net-n">{{ ifc.name }}</span>
                                <span class="net-a mono">{{ ifc.address }}</span>
                            </li>
                        </ul>
                    </div>
                </template>
            </div>
        </div>
    </section>
</template>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.head { flex-shrink: 0; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--color-line); background: var(--color-bg); padding: 10px 12px; }
.head-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 850; color: var(--color-ink); }
.page-wrap { flex: 1; min-height: 0; overflow-y: auto; }
.wrap { padding: 16px; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }

.dot { width: 9px; height: 9px; border-radius: 999px; flex-shrink: 0; }
.dot.on { background: var(--win); box-shadow: 0 0 8px color-mix(in srgb, var(--win) 60%, transparent); }
.dot.off { background: var(--color-faint); }

.conn { display: flex; align-items: center; gap: 9px; padding: 11px 14px; border-radius: 13px; border: 1px solid var(--color-line); background: var(--color-bg-elev); }
.conn-name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 750; color: var(--color-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conn-tag { flex-shrink: 0; font-size: 10.5px; font-weight: 800; padding: 2px 9px; border-radius: 999px; background: var(--win-soft); color: var(--win); }
.loading { color: var(--color-faint); font-size: 13px; text-align: center; padding: 30px 0; }

.metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.metric { padding: 15px; border-radius: 16px; border: 1px solid var(--color-line); background: var(--color-bg-elev); }
.m-top { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
.m-k { font-size: 12.5px; font-weight: 800; color: var(--color-muted); letter-spacing: .02em; }
.m-k em { font-style: normal; font-weight: 600; color: var(--color-faint); font-size: 11px; }
.m-v { font-size: 27px; font-weight: 850; color: var(--color-ink); line-height: 1; font-variant-numeric: tabular-nums; }
.m-v i { font-size: 14px; font-weight: 700; color: var(--color-muted); font-style: normal; margin-left: 1px; }
.bar { height: 6px; border-radius: 999px; background: var(--well); margin: 11px 0 12px; overflow: hidden; }
.bar span { display: block; height: 100%; border-radius: 999px; transition: width .5s ease; }
.bar .lv-ok { background: var(--color-accent); }
.bar .lv-warn { background: var(--color-warn, #e6a23c); }
.bar .lv-bad { background: var(--color-bad, #d4564e); }
.m-rows { display: grid; grid-template-columns: auto 1fr; gap: 5px 10px; font-size: 12px; }
.m-rows dt { color: var(--color-faint); white-space: nowrap; }
.m-rows dd { color: var(--color-ink); text-align: right; min-width: 0; }

.card { padding: 15px; border-radius: 16px; border: 1px solid var(--color-line); background: var(--color-bg-elev); }
.c-title { font-size: 11.5px; font-weight: 800; letter-spacing: .06em; color: var(--color-faint); text-transform: uppercase; margin-bottom: 11px; }
.c-rows { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; font-size: 13px; }
.c-rows dt { color: var(--color-muted); white-space: nowrap; }
.c-rows dd { color: var(--color-ink); text-align: right; min-width: 0; }

.net { display: flex; flex-direction: column; gap: 8px; }
.net li { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 13px; }
.net-n { color: var(--color-muted); flex-shrink: 0; }
.net-a { color: var(--color-ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 560px) { .metrics { grid-template-columns: 1fr; } }
</style>
