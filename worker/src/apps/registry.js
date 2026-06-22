// 云端数据应用清单 —— 单一真相。
// apps 区路由读它分发;GET /apps 读它列清单(前端侧边栏可派生于此)。
// 加一个数据应用 = 这里加一行 + 一个 apps/<name>/ 目录。
import chats from './chats/api.js';
import notes from './notes/api.js';
import tasks from './tasks/api.js';
import settings from './settings/api.js';

export const APPS = [
    { name: 'chats', label: '对话', icon: '💬', api: chats, nav: false },
    { name: 'notes', label: '笔记', icon: '📝', api: notes, nav: false },
    { name: 'tasks', label: '任务', icon: '⏰', api: tasks, nav: false },
    { name: 'settings', label: '设置', icon: '⚙️', api: settings, nav: false },
];

export const byName = Object.fromEntries(APPS.map((a) => [a.name, a]));

// 给前端的清单视图(只列进导航的数据应用)
export const manifest = () => APPS.filter((a) => a.nav !== false).map(({ name, label, icon }) => ({ name, label, icon }));
