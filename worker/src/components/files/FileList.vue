<script setup>
import { useFilesStore, humanSize, relTime } from '@/stores/files';

const files = useFilesStore();

let pressTimer = null;
let pressTriggered = false;

function onPressStart(entry) {
    pressTriggered = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
        pressTriggered = true;
        files.openActionSheet(entry);
    }, 500);
}
function onPressEnd() { clearTimeout(pressTimer); }
function onClick(entry) {
    if (pressTriggered) { pressTriggered = false; return; }
    files.openEntry(entry);
}
</script>

<template>
    <div class="flex-1 min-h-0 overflow-y-auto">
        <div v-if="files.loading" class="p-8 text-center text-zinc-500 text-sm">加载中...</div>
        <div v-else-if="files.errorMsg" class="p-8 text-center text-red-400 text-sm">{{ files.errorMsg }}</div>
        <div v-else-if="files.viewEntries.length === 0" class="p-8 text-center text-zinc-500 text-sm">
            {{ files.filterText ? `没有匹配 "${files.filterText}" 的文件` : '（空目录）' }}
        </div>
        <div v-else>
            <button v-for="entry in files.viewEntries" :key="entry.name"
                @click="onClick(entry)"
                @pointerdown="onPressStart(entry)"
                @pointerup="onPressEnd"
                @pointerleave="onPressEnd"
                @pointercancel="onPressEnd"
                @contextmenu.prevent="files.openActionSheet(entry)"
                class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-900 border-b border-zinc-900/50 text-left transition-colors">
                <svg v-if="entry.type === 'dir'" class="shrink-0 text-emerald-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <svg v-else-if="entry.type === 'link'" class="shrink-0 text-cyan-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <svg v-else class="shrink-0 text-zinc-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span class="flex-1 min-w-0 truncate text-sm text-zinc-200">{{ entry.name }}</span>
                <span v-if="entry.type !== 'dir'" class="shrink-0 text-[11px] text-zinc-500 tabular-nums">{{ humanSize(entry.size) }}</span>
                <span class="shrink-0 text-[11px] text-zinc-600 w-20 text-right">{{ relTime(entry.mtime) }}</span>
            </button>
        </div>
    </div>
</template>
