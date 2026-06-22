<script setup>
import { useWsStore } from '@/system/stores/ws';

// 四个设备能力应用(文件/终端/状态/屏幕)在设备离线时统一渲染这块引导。
const ws = useWsStore();
const origin = location.origin;
</script>

<template>
    <div class="off">
        <div class="off-card">
            <div class="off-icon">🖥️<span class="off-dot"></span></div>
            <div class="off-title">{{ ws.device.paired ? '设备离线' : '还没有连接设备' }}</div>
            <p class="off-sub">
                这个应用要在你的电脑上执行。{{ ws.device.paired ? '去那台电脑把 One 设备端启动起来即可恢复。' : '在你想操控的电脑上把 One 设备端跑起来,连到本账户:' }}
            </p>

            <ol class="off-steps">
                <li>克隆仓库,复制 <code>computer/config.example.js</code> 为 <code>config.js</code></li>
                <li>填 <code>WORKER_URL = {{ origin }}</code>,设一个 <code>DEVICE_SECRET</code></li>
                <li>运行 <code>node computer/index.js</code></li>
            </ol>

            <div class="off-note">起来后,文件 / 终端 / 状态 / 屏幕 就都能用了。</div>
        </div>
    </div>
</template>

<style scoped>
.off { flex: 1; min-height: 0; display: grid; place-items: center; padding: 24px; overflow-y: auto; }
.off-card {
    width: 100%; max-width: 420px; padding: 28px 24px; text-align: center;
    border: 1px solid var(--color-line); border-radius: 20px; background: var(--color-bg-elev);
    box-shadow: 0 8px 30px #0000000d;
}
.off-icon { position: relative; display: inline-grid; place-items: center; font-size: 44px; line-height: 1; margin-bottom: 12px; }
.off-dot {
    position: absolute; right: -2px; bottom: 2px; width: 13px; height: 13px; border-radius: 999px;
    background: var(--color-faint); box-shadow: 0 0 0 3px var(--color-bg-elev);
}
.off-title { font-size: 18px; font-weight: 850; color: var(--color-ink); }
.off-sub { margin: 8px 0 18px; font-size: 13px; line-height: 1.7; color: var(--color-muted); }
.off-steps {
    text-align: left; display: flex; flex-direction: column; gap: 8px; margin: 0 0 16px;
    padding: 14px 16px 14px 32px; border-radius: 13px; background: var(--well);
    font-size: 12.5px; line-height: 1.7; color: var(--color-ink);
}
.off-steps code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px;
    background: var(--color-bg); border: 1px solid var(--color-line); border-radius: 5px; padding: 1px 5px;
    word-break: break-all;
}
.off-note { font-size: 12px; color: var(--color-faint); }
</style>
