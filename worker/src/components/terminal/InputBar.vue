<script setup>
import { ref } from 'vue';
import { useTerminalStore } from '@/stores/terminal';

const term = useTerminalStore();
const inputEl = ref(null);

defineExpose({ focus: () => inputEl.value?.focus() });
</script>

<template>
    <footer class="safe-bottom shrink-0 flex items-center gap-1.5 px-2 py-2 bg-zinc-900 border-t border-zinc-800">
        <button @click="term.togglePanel"
            class="shrink-0 w-9 h-9 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 rounded border border-zinc-700/60 transition-colors"
            :title="term.showPanel ? '隐藏面板' : '显示面板'">
            <span class="text-xs">{{ term.showPanel ? '▼' : '▲' }}</span>
        </button>
        <input ref="inputEl"
            v-model="term.inputText"
            @keydown.enter="term.sendInput"
            @keydown.up.prevent="term.historyUp"
            @keydown.down.prevent="term.historyDown"
            placeholder="输入命令，回车发送"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            class="flex-1 min-w-0 px-3 h-9 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 border border-zinc-700/60 rounded focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
        />
        <button @click="term.sendInput"
            class="shrink-0 px-4 h-9 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded transition-colors"
            :disabled="!term.inputText">
            发送
        </button>
    </footer>
</template>
