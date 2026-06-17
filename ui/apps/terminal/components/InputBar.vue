<script setup>
import { ref } from 'vue';
import { useTerminalStore } from '@/apps/terminal/store';

const term = useTerminalStore();
const inputEl = ref(null);

defineExpose({ focus: () => inputEl.value?.focus() });
</script>

<template>
    <footer class="safe-bottom shrink-0 flex items-center gap-1.5 px-2 py-2 bg-bg-elev border-t border-line">
        <button @click="term.togglePanel"
            class="shrink-0 w-9 h-9 flex items-center justify-center bg-bg-hi hover:bg-bg-hi active:bg-bg-hi text-ink rounded border border-line-hi/60 transition-colors"
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
            class="flex-1 min-w-0 px-3 h-9 bg-bg-hi text-ink placeholder:text-faint border border-line-hi/60 rounded focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
        />
        <button @click="term.sendInput"
            class="shrink-0 px-4 h-9 bg-accent hover:bg-accent-hi active:bg-accent-hi disabled:bg-bg-hi disabled:text-faint text-white text-sm font-medium rounded transition-colors"
            :disabled="!term.inputText">
            发送
        </button>
    </footer>
</template>
