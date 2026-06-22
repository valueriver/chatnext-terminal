// 与 worker DO 的实时连接(/do/ws?token=JWT)。单设备:不再有"选哪台"概念。
// 消息统一用 type 判别,按 app 前缀分(chat.* / fs.* / terminal.* / …)。
// 设备消息直接转发给那台唯一设备(DO 侧单目标),前端无需附 device。
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getToken } from '@/system/api';

export const useWsStore = defineStore('ws', () => {
    const state = ref('offline');     // offline | pending | connected
    const connected = computed(() => state.value === 'connected');
    const statusText = computed(() => (
        state.value === 'connected' ? '已连接'
            : state.value === 'pending' ? '连接中…'
                : '连接已断开,重连中…'
    ));

    // 唯一一台设备的状态(来自 DO 的 { type:'device', online, name, paired })
    const device = ref({ online: false, name: '', paired: false });
    const deviceOnline = computed(() => Boolean(device.value.online));

    const handlers = new Map();
    let socket = null;
    let timer = null;
    let stopped = false;

    function onMessage(key, handler) {
        handlers.set(key, handler);
        return () => handlers.delete(key);
    }

    function sendMsg(msg) {
        if (socket?.readyState !== WebSocket.OPEN) return false;
        socket.send(JSON.stringify(msg));
        return true;
    }

    function connect() {
        const token = getToken();
        if (!token) { state.value = 'offline'; return; }
        clearTimeout(timer);
        state.value = 'pending';
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${proto}//${location.host}/do/ws?token=${encodeURIComponent(token)}`);

        socket.onopen = () => { state.value = 'connected'; };
        socket.onmessage = (e) => {
            let msg; try { msg = JSON.parse(e.data); } catch { return; }
            if (msg.type === 'device') {
                device.value = { online: !!msg.online, name: msg.name || '', paired: !!msg.paired };
            }
            handlers.get(msg.type)?.(msg);
        };
        socket.onclose = () => {
            state.value = 'offline';
            device.value = { ...device.value, online: false };
            if (!stopped) { clearTimeout(timer); timer = setTimeout(connect, 3000); }
        };
        socket.onerror = () => {};
    }

    function start() { stopped = false; connect(); }
    function stop() { stopped = true; clearTimeout(timer); try { socket?.close(); } catch { /* ignore */ } }

    return {
        state, connected, statusText,
        device, deviceOnline,
        onMessage, sendMsg, start, stop,
    };
});
