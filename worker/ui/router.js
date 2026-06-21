import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';

const routes = [
    { path: '/', redirect: '/chat' },
    { path: '/guard', name: 'guard', meta: { public: true }, component: () => import('./system/auth/GuardView.vue') },
    { path: '/setup', name: 'setup', meta: { public: true }, component: () => import('./system/auth/SetupView.vue') },

    // 云端应用(跟设备无关)。对话是资源,id 进 URL
    { path: '/chat', name: 'chat', component: () => import('./apps/chat/index.vue') },
    { path: '/chat/:id', name: 'chat-id', component: () => import('./apps/chat/index.vue') },
    { path: '/notes', name: 'notes', component: () => import('./apps/notes/index.vue') },
    { path: '/outlines', name: 'outlines', component: () => import('./apps/outlines/index.vue') },
    { path: '/settings', name: 'settings', component: () => import('./apps/settings/index.vue') },

    // 设备应用:设备 id 编进路由,URL 即"哪台设备"的唯一真相
    { path: '/devices/:id/home', name: 'd-home', component: () => import('./apps/home/index.vue') },
    { path: '/devices/:id/files', name: 'd-files', component: () => import('./apps/files/index.vue') },
    { path: '/devices/:id/terminal', name: 'd-terminal', component: () => import('./apps/terminal/index.vue') },
    { path: '/devices/:id/screen', name: 'd-screen', component: () => import('./apps/screen/index.vue') },

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

// 设备 id 从路由同步给 ws —— 设备消息据此路由到那台机器
router.afterEach((to) => {
    useWsStore().setDevice(to.params.id || '');
});
