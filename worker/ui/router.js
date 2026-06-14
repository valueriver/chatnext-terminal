import { createRouter, createWebHistory } from 'vue-router';
import { useWsStore } from '@/system/stores/ws';

const routes = [
    { path: '/', redirect: (to) => ({ path: '/guard', query: to.query }) },
    {
        path: '/guard',
        name: 'guard',
        meta: { public: true },
        component: () => import('./system/auth/GuardView.vue'),
    },
    {
        path: '/chat',
        name: 'chat',
        component: () => import('./apps/chat/index.vue'),
    },
    {
        path: '/terminal',
        name: 'terminal',
        component: () => import('./apps/terminal/index.vue'),
    },
    {
        path: '/files',
        name: 'files',
        component: () => import('./apps/files/index.vue'),
    },
    {
        path: '/status',
        name: 'status',
        component: () => import('./apps/status/index.vue'),
    },
    {
        path: '/screen',
        name: 'screen',
        component: () => import('./apps/screen/index.vue'),
    },
    {
        path: '/settings',
        name: 'settings',
        component: () => import('./apps/settings/index.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: (to) => ({ path: '/guard', query: to.query }) },
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to, from) => {
    const patched = { ...to };
    if (!to.query.session && from.query.session) {
        patched.query = { ...to.query, session: from.query.session };
        return patched;
    }

    if (to.meta?.public) return true;

    const ws = useWsStore();
    if (ws.requiresPassword && !ws.authenticated && !ws.isReconnecting) {
        return { path: '/guard', query: to.query };
    }
    return true;
});
