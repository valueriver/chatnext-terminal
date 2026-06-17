import { defineStore } from 'pinia';

export const useViewStore = defineStore('view', () => {
    const navItems = [
        { path: '/chat', label: '对话', icon: '💬' },
        { path: '/notes', label: '笔记', icon: '📝' },
        { path: '/outline', label: '大纲', icon: '🌳' },
        { path: '/tasks', label: '任务', icon: '⏱️' },
        { path: '/evolution', label: '进化', icon: '🧬' },
        { path: '/memories', label: '记忆', icon: '📚' },
        { path: '/revelation', label: '启示', icon: '🌅' },
        { path: '/terminal', label: '终端', icon: '⌨️' },
        { path: '/files', label: '文件', icon: '📁' },
        { path: '/status', label: '状态', icon: '📊' },
        { path: '/screen', label: '屏幕', icon: '🖥️' },
        { path: '/settings', label: '设置', icon: '⚙️' },
    ];

    return { navItems };
});
