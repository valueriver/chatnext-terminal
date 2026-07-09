<script setup>
import { useFilesStore, humanSize } from '@/stores/files';
const files = useFilesStore();

function handle(kind) {
    const e = files.actionSheet;
    if (!e) return;
    files.closeActionSheet();
    if (kind === 'download') files.downloadEntry(e);
    else if (kind === 'rename') files.renameEntry(e);
    else if (kind === 'delete') files.deleteEntry(e);
}
</script>

<template>
    <div v-if="files.actionSheet"
        class="fade-enter fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        @click.self="files.closeActionSheet">
        <div class="sheet-enter w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl safe-bottom">
            <div class="px-4 py-3 border-b border-zinc-800">
                <div class="text-sm text-zinc-100 truncate">{{ files.actionSheet.name }}</div>
                <div class="text-[11px] text-zinc-500 mt-0.5">
                    {{ files.actionSheet.type === 'dir' ? '目录' : humanSize(files.actionSheet.size) }}
                </div>
            </div>
            <div class="p-2">
                <button v-if="files.actionSheet.type !== 'dir'" @click="handle('download')"
                    class="w-full px-3 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                    下载到本地
                </button>
                <button @click="handle('rename')"
                    class="w-full px-3 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                    重命名
                </button>
                <button @click="handle('delete')"
                    class="w-full px-3 py-3 text-left text-sm text-red-400 hover:bg-red-900/30 rounded transition-colors">
                    删除
                </button>
            </div>
            <div class="p-2 border-t border-zinc-800">
                <button @click="files.closeActionSheet"
                    class="w-full px-3 py-3 text-center text-sm text-zinc-400 hover:bg-zinc-800 rounded transition-colors">
                    取消
                </button>
            </div>
        </div>
    </div>
</template>
