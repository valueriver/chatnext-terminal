<script>
// 模块级:WS 请求池 + handler 单次绑定
const pending = new Map();
let bound = false;

function newReqId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ensureBound(ws) {
    if (bound) return;
    bound = true;
    ws.onMessage('screen.capture.result', (msg) => {
        const h = pending.get(msg.data?.reqId);
        if (!h) return;
        pending.delete(msg.data.reqId);
        clearTimeout(h.timer);
        if (msg.data.ok) h.resolve(msg.data);
        else h.reject(new Error(msg.data.error || '截图失败'));
    });
}
</script>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import ScreenToolbar from '../components/ScreenToolbar.vue';
import DeviceOffline from '@/system/components/DeviceOffline.vue';

const ws = useWsStore();
ensureBound(ws);

const loading = ref(false);
const errorMsg = ref('');
const imageUrl = ref('');
const capturedAt = ref(0);
const naturalSize = ref({ width: 0, height: 0 });

const capturedText = computed(() => {
    if (!capturedAt.value) return '尚未截图';
    return new Date(capturedAt.value).toLocaleString();
});

const sizeText = computed(() => {
    const { width, height } = naturalSize.value;
    return width && height ? `${width} x ${height}` : '';
});

function clearImage() {
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = '';
    naturalSize.value = { width: 0, height: 0 };
}

function callCapture(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const reqId = newReqId();
        const timer = setTimeout(() => {
            pending.delete(reqId);
            reject(new Error('截图响应超时'));
        }, timeoutMs);
        pending.set(reqId, { resolve, reject, timer });
        ws.sendMsg({ type: 'screen.capture', to: 'desktop', data: { reqId } });
    });
}

async function capture() {
    loading.value = true;
    errorMsg.value = '';
    try {
        const res = await callCapture();
        const bin = atob(res.data || '');
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: res.mime || 'image/png' });
        clearImage();
        imageUrl.value = URL.createObjectURL(blob);
        capturedAt.value = res.capturedAt || Date.now();
    } catch (err) {
        errorMsg.value = err.message || String(err);
    } finally {
        loading.value = false;
    }
}

function onImageLoad(e) {
    naturalSize.value = { width: e.target.naturalWidth, height: e.target.naturalHeight };
}

onMounted(() => {
    if (ws.connected && !imageUrl.value) capture();
});

watch(() => ws.connected, (ready) => {
    if (ready && !imageUrl.value && !loading.value) capture();
});

onUnmounted(() => {
    clearImage();
});
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col bg-bg">
        <ScreenToolbar
            :can-capture="ws.deviceOnline"
            :loading="loading"
            :captured-text="capturedText"
            :size-text="sizeText"
            @capture="capture"
        />

        <DeviceOffline v-if="!ws.deviceOnline" />
        <main v-else class="relative min-h-0 flex-1 overflow-auto bg-bg">
            <div v-if="errorMsg" class="flex h-full items-center justify-center px-4 text-center">
                <div>
                    <div class="mb-3 text-sm text-bad">{{ errorMsg }}</div>
                    <button
                        @click="capture"
                        class="inline-flex h-9 items-center justify-center rounded border border-line-hi bg-bg-hi px-3 text-sm text-ink hover:bg-bg-hi">
                        重试
                    </button>
                </div>
            </div>

            <div v-else-if="imageUrl" class="flex min-h-full items-start justify-center p-3">
                <img
                    :src="imageUrl"
                    alt="桌面截图"
                    class="h-auto max-w-full rounded border border-line bg-bg shadow-2xl"
                    :class="{ 'opacity-70': loading }"
                    @load="onImageLoad" />
            </div>

            <div v-else class="flex h-full items-center justify-center text-sm text-muted">
                {{ loading ? '正在获取桌面截图...' : '点击刷新获取截图' }}
            </div>
        </main>
    </div>
</template>
