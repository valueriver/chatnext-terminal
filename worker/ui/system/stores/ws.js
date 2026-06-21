// 与 worker DO 的实时连接(/do/ws?token=JWT)。只暴露真实状态,无旧鉴权概念。
// 消息派发:chat.* 用 t;终端/文件/屏幕/状态用 type。
// 设备能力消息(有 type)自动附 device=当前选中设备 → DO 路由到那台机器。
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getToken } from '@/system/api';

export const useWsStore = defineStore('ws', () => {
    const state = ref('offline');     // offline | pending | connected
    const devices = ref([]);          // [{id,name,online}]
    const connected = computed(() => state.value === 'connected');
    const statusText = computed(() => (
        state.value === 'connected' ? '已连接'
            : state.value === 'pending' ? '连接中…'
                : '连接已断开,重连中…'
    ));

    // 当前设备 = 路由 /devices/:id 里的 id(由 router.afterEach 注入)。URL 即唯一真相。
    const deviceId = ref('');
    const onlineDevices = computed(() => devices.value.filter((d) => d.online));
    const currentDevice = computed(() => devices.value.find((d) => d.id === deviceId.value) || null);
    function setDevice(id) { deviceId.value = id || ''; }

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
        // 设备能力消息(有 type 的)路由到路由指定的设备
        if (msg.type && !msg.device && deviceId.value) msg.device = deviceId.value;
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
            if (msg.t === 'devices') { devices.value = msg.devices || []; }
            handlers.get(msg.t || msg.type)?.(msg);
        };
        socket.onclose = () => {
            state.value = 'offline';
            if (!stopped) { clearTimeout(timer); timer = setTimeout(connect, 3000); }
        };
        socket.onerror = () => {};
    }

    function start() { stopped = false; connect(); }
    function stop() { stopped = true; clearTimeout(timer); try { socket?.close(); } catch { /* ignore */ } }

    return {
        state, devices, connected, statusText,
        onlineDevices, currentDevice, setDevice,
        onMessage, sendMsg, start, stop,
    };
});
