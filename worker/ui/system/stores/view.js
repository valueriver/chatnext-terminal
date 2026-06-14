import { defineStore } from 'pinia';

export const useViewStore = defineStore('view', () => {
    const navItems = [
        { path: '/chat', label: '对话', icon: '💬' },
        { path: '/terminal', label: '终端', icon: '⌨️' },
        { path: '/files', label: '文件', icon: '📁' },
        { path: '/status', label: '状态', icon: '📊' },
        { path: '/screen', label: '屏幕', icon: '🖥️' },
        { path: '/settings', label: '设置', icon: '⚙️' },
    ];

    return { navItems };
});
