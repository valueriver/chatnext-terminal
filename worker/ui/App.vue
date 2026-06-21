<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWsStore } from '@/system/stores/ws';
import { getToken, setToken, getState, api } from '@/system/api';
import ToastHost from '@/system/components/ToastHost.vue';
import ConnectionGate from '@/system/components/ConnectionGate.vue';

const ws = useWsStore();
const route = useRoute();
const router = useRouter();

const PUBLIC = new Set(['guard', 'setup']);
const showGate = computed(() => !PUBLIC.has(route.name));

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

    <ConnectionGate v-if="showGate" />
    <ToastHost />
</template>
