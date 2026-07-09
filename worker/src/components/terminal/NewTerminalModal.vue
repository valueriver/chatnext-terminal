<script setup>
import { computed, ref, watch } from 'vue';
import { useTerminalStore } from '@/stores/terminal';
import { useFsClient } from '@/composables/useFsClient';

const props = defineProps({
    open: { type: Boolean, default: false }
});

const emit = defineEmits(['close']);

const term = useTerminalStore();
const fs = useFsClient();

const loading = ref(false);
const creating = ref(false);
const errorMsg = ref('');
const homePath = ref('');
const pathSep = ref('/');
const cwd = ref('');
const pathInput = ref('');
const entries = ref([]);

const directoryEntries = computed(() => (entries.value || []).filter((item) => item.type === 'dir'));

async function navigate(targetPath) {
    const nextPath = String(targetPath || '').trim();
    if (!nextPath) return;
    loading.value = true;
    errorMsg.value = '';
    try {
        const res = await fs.fsList(nextPath, false);
        cwd.value = res.path || nextPath;
        pathInput.value = cwd.value;
        entries.value = res.entries || [];
    } catch (error) {
        errorMsg.value = error.message || '目录读取失败';
    } finally {
        loading.value = false;
    }
}

function joinPath(dir, name) {
    if (pathSep.value === '\\') {
        if (!dir) return name;
        if (/^[A-Za-z]:\\?$/.test(dir)) return `${dir.replace(/\\?$/, '\\')}${name}`;
        return `${dir.replace(/[\\]+$/, '')}\\${name}`;
    }
    if (!dir || dir === '/') return `/${name}`;
    return `${dir}/${name}`;
}

function parentPath(dir) {
    if (!dir) return dir;
    if (pathSep.value === '\\') {
        const normalized = dir.replace(/[\\]+$/, '');
        if (/^[A-Za-z]:$/.test(normalized)) return `${normalized}\\`;
        const idx = normalized.lastIndexOf('\\');
        if (idx <= 2) return `${normalized.slice(0, 2)}\\`;
        return normalized.slice(0, idx);
    }
    if (dir === '/') return '/';
    const normalized = dir.replace(/\/+$/, '');
    const idx = normalized.lastIndexOf('/');
    return idx <= 0 ? '/' : normalized.slice(0, idx);
}

async function ensureInit() {
    loading.value = true;
    errorMsg.value = '';
    try {
        const home = await fs.fsHome();
        homePath.value = home.path || '';
        pathSep.value = home.sep || '/';
        const desktop = home.path
            ? (pathSep.value === '\\' ? `${home.path}\\Desktop` : `${home.path}/Desktop`)
            : '';
        const initial = desktop || term.recentDirs[0] || home.path || '';
        await navigate(initial);
    } catch (error) {
        errorMsg.value = error.message || '初始化失败';
    } finally {
        loading.value = false;
    }
}

function goUp() {
    if (!cwd.value) return;
    const next = parentPath(cwd.value);
    if (!next || next === cwd.value) return;
    navigate(next);
}

function onPathEnter() {
    navigate(pathInput.value);
}

async function createTerminal() {
    const target = String(pathInput.value || cwd.value || '').trim();
    if (!target) {
        errorMsg.value = '请选择启动目录';
        return;
    }
    creating.value = true;
    errorMsg.value = '';
    try {
        const res = await fs.fsStat(target);
        if (res.type !== 'dir') {
            throw new Error('启动目录不是文件夹');
        }
        term.createTerminal({ cwd: target });
        emit('close');
    } catch (error) {
        errorMsg.value = error.message || '创建终端失败';
    } finally {
        creating.value = false;
    }
}

watch(() => props.open, (open) => {
    if (open) ensureInit();
});
</script>

<template>
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button class="absolute inset-0 bg-black/70" @click="emit('close')"></button>
        <section class="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
            <header class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                    <h2 class="text-sm font-semibold text-zinc-100">新建终端</h2>
                    <p class="mt-1 text-xs text-zinc-500">选择启动目录，最近用过的目录会保存在下面</p>
                </div>
                <button class="h-8 w-8 rounded bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" @click="emit('close')">✕</button>
            </header>

            <div class="space-y-4 overflow-y-auto px-4 py-4">
                <section v-if="term.recentDirs.length" class="space-y-2">
                    <div class="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">最近目录</div>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="dir in term.recentDirs"
                            :key="dir"
                            class="max-w-full rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-left text-xs text-zinc-300 hover:border-emerald-600 hover:text-zinc-100"
                            @click="navigate(dir)"
                        >
                            {{ dir }}
                        </button>
                    </div>
                </section>

                <section class="space-y-2">
                    <div class="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">启动目录</div>
                    <div class="flex items-center gap-2">
                        <input
                            v-model="pathInput"
                            class="h-10 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-500"
                            placeholder="输入完整路径"
                            @keydown.enter.prevent="onPathEnter"
                        />
                        <button class="h-10 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-900" @click="onPathEnter">前往</button>
                    </div>
                    <div v-if="errorMsg" class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">{{ errorMsg }}</div>
                </section>

                <section class="space-y-2">
                    <div class="flex items-center gap-2">
                        <button class="h-8 w-8 rounded bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" @click="goUp" title="上一级">↑</button>
                        <button class="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800" @click="navigate(homePath)">Home</button>
                        <button class="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800" @click="navigate(pathSep === '\\' ? `${homePath}\\Desktop` : `${homePath}/Desktop`)">Desktop</button>
                        <div class="truncate text-xs text-zinc-500">{{ cwd || '未选择目录' }}</div>
                    </div>

                    <div class="max-h-[320px] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
                        <div v-if="loading" class="px-4 py-8 text-center text-sm text-zinc-500">目录读取中...</div>
                        <div v-else-if="directoryEntries.length === 0" class="px-4 py-8 text-center text-sm text-zinc-500">当前目录下没有可进入的子目录</div>
                        <button
                            v-for="entry in directoryEntries"
                            :key="entry.name"
                            class="flex w-full items-center justify-between border-b border-zinc-800/70 px-4 py-3 text-left transition hover:bg-zinc-800/60 last:border-b-0"
                            @click="navigate(joinPath(cwd, entry.name))"
                        >
                            <span class="truncate text-sm text-zinc-200">{{ entry.name }}</span>
                            <span class="ml-3 text-xs text-zinc-500">进入</span>
                        </button>
                    </div>
                </section>
            </div>

            <footer class="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
                <div class="text-xs text-zinc-500">创建后会在当前 session 下新增一个独立终端 tab</div>
                <div class="flex items-center gap-2">
                    <button class="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" @click="emit('close')">取消</button>
                    <button
                        class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500"
                        :disabled="creating"
                        @click="createTerminal"
                    >
                        {{ creating ? '创建中...' : '新建终端' }}
                    </button>
                </div>
            </footer>
        </section>
    </div>
</template>
