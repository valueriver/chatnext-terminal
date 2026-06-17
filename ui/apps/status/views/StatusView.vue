<script>
const pending = new Map();
let bound = false;

function newReqId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ensureBound(ws) {
    if (bound) return;
    bound = true;
    ws.onMessage('status.result', (msg) => {
        const h = pending.get(msg.data?.reqId);
        if (!h) return;
        pending.delete(msg.data.reqId);
        clearTimeout(h.timer);
        if (msg.data.ok) h.resolve(msg.data);
        else h.reject(new Error(msg.data.error || '获取状态失败'));
    });
}
</script>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import StatusToolbar from '../components/StatusToolbar.vue';

const ws = useWsStore();
ensureBound(ws);

const data = ref(null);
const loading = ref(false);
const errorMsg = ref('');
const capturedAt = ref(0);

let pollTimer = null;

const d = computed(() => data.value);

const capturedText = computed(() => {
    if (!capturedAt.value) return '尚未获取';
    return new Date(capturedAt.value).toLocaleString();
});

function callOnce(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const reqId = newReqId();
        const timer = setTimeout(() => {
            pending.delete(reqId);
            reject(new Error('请求超时'));
        }, timeoutMs);
        pending.set(reqId, { resolve, reject, timer });
        ws.sendMsg({ type: 'status.request', to: 'desktop', data: { reqId } });
    });
}

async function refresh() {
    if (!ws.canUseActions) return;
    loading.value = true;
    errorMsg.value = '';
    try {
        const res = await callOnce();
        const { reqId, ok, ...rest } = res;
        data.value = rest;
        capturedAt.value = rest.capturedAt || Date.now();
    } catch (err) {
        errorMsg.value = err.message || String(err);
    } finally {
        loading.value = false;
    }
}

function startPolling(intervalMs = 5000) {
    stopPolling();
    refresh();
    pollTimer = setInterval(refresh, intervalMs);
}

function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
}

function fmtBytes(n) {
    if (!Number.isFinite(n) || n <= 0) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
}

function fmtUptime(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return '—';
    const dd = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const parts = [];
    if (dd) parts.push(`${dd}天`);
    if (h) parts.push(`${h}小时`);
    if (m || (!dd && !h)) parts.push(`${m}分钟`);
    return parts.join(' ');
}

function pctClass(p) {
    if (p < 60) return 'bg-accent';
    if (p < 85) return 'bg-warn';
    return 'bg-rose-500';
}

onMounted(() => {
    if (ws.canUseActions) startPolling(5000);
});

watch(() => ws.canUseActions, (ready) => {
    if (ready) startPolling(5000);
    else stopPolling();
});

onUnmounted(stopPolling);
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col bg-bg">
        <StatusToolbar
            :loading="loading"
            :disabled="!ws.canUseActions"
            :error="errorMsg"
            :captured-text="capturedText"
            @refresh="refresh"
        />

        <main v-if="!ws.showActions && !ws.isReconnecting"
            class="flex-1 min-h-0 flex items-center justify-center text-sm text-muted">
            等待客户端连接和认证
        </main>

        <main v-else-if="!d && loading"
            class="flex-1 min-h-0 flex items-center justify-center text-sm text-muted">
            正在获取系统状态...
        </main>

        <main v-else-if="d" class="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <div class="mx-auto w-full max-w-2xl space-y-4">
                <section class="rounded-lg border border-line bg-bg-elev/40 p-4">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-3">主机</h3>
                    <dl class="grid grid-cols-2 gap-y-2 text-sm">
                        <dt class="text-muted">主机名</dt>
                        <dd class="text-ink truncate">{{ d.host.hostname }}</dd>
                        <dt class="text-muted">系统</dt>
                        <dd class="text-ink">{{ d.host.platform }} {{ d.host.release }}</dd>
                        <dt class="text-muted">架构</dt>
                        <dd class="text-ink">{{ d.host.arch }}</dd>
                        <dt class="text-muted">运行时长</dt>
                        <dd class="text-ink">{{ fmtUptime(d.host.uptime) }}</dd>
                    </dl>
                </section>

                <section class="rounded-lg border border-line bg-bg-elev/40 p-4">
                    <div class="flex items-baseline justify-between mb-3">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">CPU</h3>
                        <div class="text-2xl font-mono text-ink">{{ d.cpu.usagePercent }}<span class="text-base text-muted"> %</span></div>
                    </div>
                    <div class="h-1.5 rounded bg-bg-hi overflow-hidden mb-3">
                        <div class="h-full transition-all" :class="pctClass(d.cpu.usagePercent)"
                            :style="`width: ${Math.min(100, d.cpu.usagePercent)}%`"></div>
                    </div>
                    <dl class="grid grid-cols-2 gap-y-2 text-sm">
                        <dt class="text-muted">核心</dt>
                        <dd class="text-ink">{{ d.cpu.count }}</dd>
                        <dt class="text-muted">型号</dt>
                        <dd class="text-ink truncate">{{ d.cpu.model }}</dd>
                        <dt class="text-muted">主频</dt>
                        <dd class="text-ink">{{ d.cpu.speed ? (d.cpu.speed / 1000).toFixed(2) + ' GHz' : '—' }}</dd>
                        <dt class="text-muted">Load 1/5/15</dt>
                        <dd class="text-ink font-mono">
                            {{ d.cpu.loadavg.map(n => n.toFixed(2)).join(' / ') }}
                        </dd>
                    </dl>
                </section>

                <section class="rounded-lg border border-line bg-bg-elev/40 p-4">
                    <div class="flex items-baseline justify-between mb-3">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">内存</h3>
                        <div class="text-2xl font-mono text-ink">{{ d.mem.percent }}<span class="text-base text-muted"> %</span></div>
                    </div>
                    <div class="h-1.5 rounded bg-bg-hi overflow-hidden mb-3">
                        <div class="h-full transition-all" :class="pctClass(d.mem.percent)"
                            :style="`width: ${Math.min(100, d.mem.percent)}%`"></div>
                    </div>
                    <dl class="grid grid-cols-2 gap-y-2 text-sm">
                        <dt class="text-muted">已用 / 总量</dt>
                        <dd class="text-ink font-mono">{{ fmtBytes(d.mem.used) }} / {{ fmtBytes(d.mem.total) }}</dd>
                        <dt class="text-muted">空闲</dt>
                        <dd class="text-ink font-mono">{{ fmtBytes(d.mem.free) }}</dd>
                    </dl>
                </section>

                <section v-if="d.disk" class="rounded-lg border border-line bg-bg-elev/40 p-4">
                    <div class="flex items-baseline justify-between mb-3">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">磁盘 ({{ d.disk.mount }})</h3>
                        <div class="text-2xl font-mono text-ink">{{ d.disk.percent }}<span class="text-base text-muted"> %</span></div>
                    </div>
                    <div class="h-1.5 rounded bg-bg-hi overflow-hidden mb-3">
                        <div class="h-full transition-all" :class="pctClass(d.disk.percent)"
                            :style="`width: ${Math.min(100, d.disk.percent)}%`"></div>
                    </div>
                    <dl class="grid grid-cols-2 gap-y-2 text-sm">
                        <dt class="text-muted">已用 / 总量</dt>
                        <dd class="text-ink font-mono">{{ fmtBytes(d.disk.used) }} / {{ fmtBytes(d.disk.total) }}</dd>
                        <dt class="text-muted">可用</dt>
                        <dd class="text-ink font-mono">{{ fmtBytes(d.disk.free) }}</dd>
                    </dl>
                </section>

                <section v-if="d.network?.length" class="rounded-lg border border-line bg-bg-elev/40 p-4">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-3">网络</h3>
                    <ul class="text-sm space-y-1.5">
                        <li v-for="iface in d.network" :key="iface.name + iface.address"
                            class="flex justify-between gap-3">
                            <span class="text-muted shrink-0">{{ iface.name }}</span>
                            <span class="text-ink font-mono truncate">{{ iface.address }}</span>
                        </li>
                    </ul>
                </section>
            </div>
        </main>
    </div>
</template>
