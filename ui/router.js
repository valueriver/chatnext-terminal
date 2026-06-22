import { createRouter, createWebHistory } from 'vue-router';
import { useWsStore } from '@/system/stores/ws';

const apps = [
    { path: 'chat',       name: 'chat',       component: () => import('./apps/chat/index.vue') },
    { path: 'terminal',   name: 'terminal',   component: () => import('./apps/terminal/index.vue') },
    { path: 'files',      name: 'files',      component: () => import('./apps/files/index.vue') },
    { path: 'notes',      name: 'notes',      component: () => import('./apps/notes/index.vue') },
    { path: 'outline',    name: 'outline',    component: () => import('./apps/outline/index.vue') },
    { path: 'tasks',      name: 'tasks',      component: () => import('./apps/tasks/index.vue') },
    { path: 'schedule',   name: 'schedule',   component: () => import('./apps/schedule/index.vue') },
    { path: 'evolution',  name: 'evolution',   component: () => import('./apps/evolution/index.vue') },
    { path: 'memories',   name: 'memories',   component: () => import('./apps/memories/index.vue') },
    { path: 'revelation', name: 'revelation', component: () => import('./apps/revelation/index.vue') },
    { path: 'status',     name: 'status',     component: () => import('./apps/status/index.vue') },
    { path: 'screen',     name: 'screen',     component: () => import('./apps/screen/index.vue') },
    { path: 'settings',   name: 'settings',   component: () => import('./apps/settings/index.vue') },
];

const routes = [
    { path: '/', component: () => import('./system/auth/GuardView.vue'), meta: { public: true } },
    {
        path: '/:session',
        children: [
            { path: '', name: 'guard', component: () => import('./system/auth/GuardView.vue'), meta: { public: true } },
            ...apps,
        ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to) => {
    if (to.meta?.public) return true;

    const ws = useWsStore();
    if (ws.requiresPassword && !ws.authenticated && !ws.isReconnecting) {
        const session = to.params.session || '';
        return session ? `/${session}` : '/';
    }
    return true;
});
