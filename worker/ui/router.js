import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '@/system/api';

// 单设备:应用全部平铺,不再有 /devices/:id 层级。
//   云数据应用:对话 / 任务 / 笔记 / 设置
//   设备能力应用:文件 / 终端 / 状态 / 屏幕(连上那台设备才有内容)
const routes = [
    { path: '/', redirect: '/chat' },
    { path: '/guard', name: 'guard', meta: { public: true }, component: () => import('./system/auth/GuardView.vue') },
    { path: '/setup', name: 'setup', meta: { public: true }, component: () => import('./system/auth/SetupView.vue') },

    // 云数据应用
    { path: '/chat', name: 'chat', component: () => import('./apps/chat/index.vue') },
    { path: '/chat/:id', name: 'chat-id', component: () => import('./apps/chat/index.vue') },
    { path: '/tasks', name: 'tasks', component: () => import('./apps/tasks/index.vue') },
    { path: '/notes', name: 'notes', component: () => import('./apps/notes/index.vue') },
    { path: '/settings', name: 'settings', component: () => import('./apps/settings/index.vue') },

    // 设备能力应用
    { path: '/files', name: 'files', component: () => import('./apps/files/index.vue') },
    { path: '/terminal', name: 'terminal', component: () => import('./apps/terminal/index.vue') },
    { path: '/status', name: 'status', component: () => import('./apps/status/index.vue') },
    { path: '/screen', name: 'screen', component: () => import('./apps/screen/index.vue') },

    { path: '/:pathMatch(.*)*', redirect: '/chat' },
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to) => {
    if (to.meta?.public) return true;
    if (!getToken()) return '/guard';
    return true;
});
