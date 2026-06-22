<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';

const router = useRouter();
const ws = useWsStore();
const password = ref('');
const error = ref('');
const busy = ref(false);

async function onSubmit() {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
        await login(password.value);
        ws.start();
        router.replace('/chat');
    } catch (e) {
        error.value = e.message || '登录失败';
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <main class="flex-1 min-h-0 flex items-center justify-center px-6 py-10 overflow-y-auto bg-bg">
        <div class="w-full max-w-sm flex flex-col items-center">
            <h1 class="font-serif font-black text-[40px] leading-none tracking-tight text-center text-ink">
                Roam<span class="text-accent">.</span>
            </h1>
            <p class="mt-3 text-xs text-muted">登录到你的云端</p>

            <form class="w-full mt-6 flex flex-col gap-3" @submit.prevent="onSubmit">
                <input
                    v-model="password"
                    type="password"
                    autocomplete="current-password"
                    placeholder="访问密码(未设则留空)"
                    class="h-11 w-full rounded-[10px] border border-line bg-bg-elev px-3 text-[13px] text-ink outline-none transition-colors focus:border-accent"
                />

                <div v-if="error"
                    class="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[11.5px] text-bad">
                    {{ error }}
                </div>

                <button type="submit"
                    class="h-11 w-full rounded-[10px] bg-accent text-bg text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    :disabled="busy">
                    {{ busy ? '登录中…' : '进入' }}
                </button>
            </form>
        </div>
    </main>
</template>
