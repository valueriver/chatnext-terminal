<script setup>
import { useFilesStore, humanSize } from '@/apps/files/store';
const files = useFilesStore();
</script>

<template>
    <div v-if="files.preview"
        class="fade-enter fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
        @click.self="files.closePreview">
        <div class="sheet-enter sm:animate-none w-full sm:max-w-3xl h-full sm:h-[85vh] bg-bg-elev border border-line sm:rounded-2xl flex flex-col safe-top safe-bottom">
            <div class="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
                <div class="min-w-0">
                    <div class="text-sm text-ink truncate">{{ files.preview.name }}</div>
                    <div class="text-[11px] text-muted truncate">{{ files.preview.mime || '未知类型' }} · {{ humanSize(files.preview.size) }}</div>
                </div>
                <div class="shrink-0 flex items-center gap-1">
                    <div v-if="files.canRenderPreview()" class="flex items-center p-0.5 rounded border border-line-hi bg-bg">
                        <button @click="files.setPreviewMode('source')"
                            class="px-2 h-7 text-xs rounded transition-colors"
                            :class="files.previewMode === 'source' ? 'bg-bg-hi text-ink' : 'text-muted hover:text-ink'">
                            源码
                        </button>
                        <button @click="files.setPreviewMode('render')"
                            class="px-2 h-7 text-xs rounded transition-colors"
                            :class="files.previewMode === 'render' ? 'bg-bg-hi text-ink' : 'text-muted hover:text-ink'">
                            预览
                        </button>
                    </div>
                    <button @click="files.downloadPreview"
                        class="px-3 h-8 bg-bg-hi hover:bg-bg-hi text-ink text-xs rounded border border-line-hi transition-colors">
                        下载
                    </button>
                    <button @click="files.closePreview"
                        class="w-8 h-8 flex items-center justify-center text-muted hover:text-ink hover:bg-bg-hi rounded transition-colors">
                        ✕
                    </button>
                </div>
            </div>
            <div class="flex-1 min-h-0 overflow-auto">
                <div v-if="files.preview.kind === 'loading'" class="h-full flex items-center justify-center text-muted text-sm">加载中...</div>
                <div v-else-if="files.preview.kind === 'error'" class="h-full flex items-center justify-center text-bad text-sm p-4">{{ files.preview.error }}</div>
                <template v-else-if="files.preview.kind === 'text'">
                    <div v-if="files.previewMode === 'render' && files.preview.format === 'html'" class="h-full bg-white">
                        <iframe class="w-full h-full border-0 bg-white" sandbox="" :srcdoc="files.preview.content"></iframe>
                    </div>
                    <div v-else-if="files.previewMode === 'render' && files.preview.format === 'markdown'"
                        class="p-5 text-ink markdown-preview" v-html="files.renderedPreview"></div>
                    <pre v-else class="p-4 font-mono text-xs text-ink whitespace-pre-wrap break-all">{{ files.preview.content }}</pre>
                </template>
                <div v-else-if="files.preview.kind === 'image'" class="h-full flex items-center justify-center p-4">
                    <img :src="files.preview.url" class="max-w-full max-h-full object-contain" />
                </div>
                <div v-else class="h-full flex flex-col items-center justify-center text-muted text-sm p-6 gap-3">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <div>无法预览此文件类型</div>
                    <button @click="files.downloadPreview" class="px-4 h-9 bg-accent hover:bg-accent-hi text-white text-sm rounded">下载查看</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.markdown-preview :deep(h1) { font-size: 1.5rem; font-weight: 700; margin: 0.8em 0 0.5em; }
.markdown-preview :deep(h2) { font-size: 1.25rem; font-weight: 700; margin: 0.8em 0 0.45em; }
.markdown-preview :deep(h3) { font-size: 1.08rem; font-weight: 700; margin: 0.7em 0 0.4em; }
.markdown-preview :deep(p) { margin: 0.65em 0; line-height: 1.7; }
.markdown-preview :deep(ul), .markdown-preview :deep(ol) { padding-left: 1.4em; margin: 0.65em 0; }
.markdown-preview :deep(ul) { list-style: disc; }
.markdown-preview :deep(ol) { list-style: decimal; }
.markdown-preview :deep(blockquote) { border-left: 3px solid var(--color-line-hi, #d0d0d0); padding-left: 0.9em; color: var(--color-muted); margin: 0.8em 0; }
.markdown-preview :deep(code) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; background: var(--color-bg-hi); padding: 0.15em 0.35em; border-radius: 0.35em; }
.markdown-preview :deep(pre) { overflow: auto; background: var(--color-bg-hi); padding: 0.9em; border-radius: 0.75em; margin: 0.8em 0; }
.markdown-preview :deep(pre code) { background: transparent; padding: 0; }
.markdown-preview :deep(a) { color: var(--color-accent); text-decoration: underline; }
.markdown-preview :deep(table) { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
.markdown-preview :deep(th), .markdown-preview :deep(td) { border: 1px solid var(--color-line); padding: 0.45em 0.6em; }
.markdown-preview :deep(img) { max-width: 100%; }
</style>
