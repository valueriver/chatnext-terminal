<script setup>
import { useFilesStore, humanSize } from '@/apps/files/store';
const files = useFilesStore();
</script>

<template>
    <div v-if="files.uploadProgress" class="shrink-0 px-3 py-2 bg-bg-elev border-t border-line">
        <div class="flex items-center justify-between text-xs">
            <span class="truncate text-ink">↑ {{ files.uploadProgress.filename }}</span>
            <span class="shrink-0 ml-2 text-muted tabular-nums">
                {{ humanSize(files.uploadProgress.loaded) }} / {{ humanSize(files.uploadProgress.total) }}
            </span>
        </div>
        <div class="mt-1 h-1 bg-bg-hi rounded overflow-hidden">
            <div class="h-full bg-accent transition-all"
                 :style="{ width: (files.uploadProgress.total ? (files.uploadProgress.loaded / files.uploadProgress.total * 100) : 100) + '%' }"></div>
        </div>
    </div>
</template>
