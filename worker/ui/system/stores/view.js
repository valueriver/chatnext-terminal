import { defineStore } from 'pinia';
import { ref } from 'vue';

// 应用面板 = 单一真相,平铺 6 个(单设备,无设备子层)。
// 两类:云应用(对话/设置)+ 设备能力应用(文件/终端/状态/屏幕)。
// 能力应用 needsDevice:设备没连时面板里点进去显示"未连接"占位(各 app 自管)。
export const useViewStore = defineStore('view', () => {
    const apps = ref([
        { path: '/chat', label: '对话', icon: '💬' },
        { path: '/notes', label: '笔记', icon: '📝' },
        { path: '/tasks', label: '任务', icon: '⏰' },
        { path: '/files', label: '文件', icon: '📁', needsDevice: true },
        { path: '/terminal', label: '终端', icon: '⌨️', needsDevice: true },
        { path: '/status', label: '状态', icon: '📊', needsDevice: true },
        { path: '/screen', label: '屏幕', icon: '🖥️', needsDevice: true },
        { path: '/settings', label: '设置', icon: '⚙️' },
    ]);

    return { apps };
});
