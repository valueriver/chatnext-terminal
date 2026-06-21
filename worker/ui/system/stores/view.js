import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/system/api';

// 中控台两层:
//   云端组(第一组)— 对话 + 数据应用 + 设置,跟设备无关。
//   设备子导航 — 进入某设备后用:主页(/status,含连接+本机状态)/文件/终端/屏幕。
export const useViewStore = defineStore('view', () => {
    const CLOUD_FIXED = [{ path: '/chat', label: '对话', icon: '💬' }];
    const SETTINGS = { path: '/settings', label: '设置', icon: '⚙️' };

    // 设备内四项(seg 拼到 /devices/:id/<seg>)。主页 = 连接 + 本机状态
    const DEVICE_NAV = [
        { seg: 'home', label: '主页', icon: '🏠' },
        { seg: 'files', label: '文件', icon: '📁' },
        { seg: 'terminal', label: '终端', icon: '⌨️' },
        { seg: 'screen', label: '屏幕', icon: '🖥️' },
    ];

    const dataApps = ref([]);
    const cloudItems = computed(() => [...CLOUD_FIXED, ...dataApps.value, SETTINGS]);
    const deviceNav = computed(() => DEVICE_NAV);

    async function load() {
        try {
            const { apps } = await api.get('/apps');
            dataApps.value = (apps || []).map((a) => ({ path: `/${a.name}`, label: a.label, icon: a.icon }));
        } catch { /* ignore */ }
    }

    return { cloudItems, deviceNav, load };
});
