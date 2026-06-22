<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useWsStore } from '@/system/stores/ws';
import { getToken, setToken, getState, api } from '@/system/api';
import ToastHost from '@/system/components/ToastHost.vue';

const ws = useWsStore();
const router = useRouter();

async function toFirstRun() {
    const { hasPassword } = await getState();
    router.replace(hasPassword ? '/guard' : '/setup');
}

onMounted(async () => {
    if (getToken()) {
        try { await api.get('/apps'); ws.start(); return; } // token 有效 → 连
        catch { setToken(''); }                              // 失效 → 落到首次引导
    }
    await toFirstRun();
});
</script>

<template>
    <router-view v-slot="{ Component }">
        <keep-alive>
            <component :is="Component" />
        </keep-alive>
    </router-view>

    <ToastHost />
</template>
