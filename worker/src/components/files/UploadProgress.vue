<script setup>
import { useFilesStore, humanSize } from '@/stores/files';
const files = useFilesStore();
</script>

<template>
    <div v-if="files.uploadProgress" class="shrink-0 px-3 py-2 bg-zinc-900 border-t border-zinc-800">
        <div class="flex items-center justify-between text-xs">
            <span class="truncate text-zinc-300">↑ {{ files.uploadProgress.filename }}</span>
            <span class="shrink-0 ml-2 text-zinc-500 tabular-nums">
                {{ humanSize(files.uploadProgress.loaded) }} / {{ humanSize(files.uploadProgress.total) }}
            </span>
        </div>
        <div class="mt-1 h-1 bg-zinc-800 rounded overflow-hidden">
            <div class="h-full bg-emerald-500 transition-all"
                 :style="{ width: (files.uploadProgress.total ? (files.uploadProgress.loaded / files.uploadProgress.total * 100) : 100) + '%' }"></div>
        </div>
    </div>
</template>
