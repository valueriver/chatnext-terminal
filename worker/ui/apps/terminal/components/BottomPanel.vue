<script setup>
import { useTerminalStore, NAV_KEYS, CTRL_KEYS } from '@/apps/terminal/store';
import { useSnippetsStore } from '@/apps/terminal/snippets';

const term = useTerminalStore();
const snippets = useSnippetsStore();

const emit = defineEmits(['openAddSnippet', 'editSnippet', 'runSnippet']);

let pressTimer = null;
let pressTriggered = false;

function onPressStart(s) {
    pressTriggered = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
        pressTriggered = true;
        emit('editSnippet', s);
    }, 500);
}
function onPressEnd() { clearTimeout(pressTimer); }
function onSnippetClick(s) {
    if (pressTriggered) { pressTriggered = false; return; }
    emit('runSnippet', s);
}
</script>

<template>
    <section class="shrink-0 bg-bg-elev border-t border-line">
        <div class="flex items-center px-2 border-b border-line/70">
            <button @click="term.setTab('keys')"
                class="relative px-3 py-2 text-xs transition-colors"
                :class="term.activeTab === 'keys' ? 'text-ink' : 'text-muted hover:text-ink'">
                按键
                <span v-if="term.activeTab === 'keys'" class="absolute left-2 right-2 bottom-0 h-0.5 bg-accent rounded"></span>
            </button>
            <button @click="term.setTab('commands')"
                class="relative px-3 py-2 text-xs transition-colors"
                :class="term.activeTab === 'commands' ? 'text-ink' : 'text-muted hover:text-ink'">
                命令
                <span v-if="snippets.snippets.length" class="ml-1 px-1.5 py-0.5 bg-bg-hi text-muted rounded text-[10px] tabular-nums">{{ snippets.snippets.length }}</span>
                <span v-if="term.activeTab === 'commands'" class="absolute left-2 right-2 bottom-0 h-0.5 bg-accent rounded"></span>
            </button>
        </div>

        <div v-show="term.activeTab === 'keys'" class="px-2 py-2 space-y-1.5">
            <div class="flex flex-wrap gap-1">
                <button v-for="key in NAV_KEYS" :key="key.label"
                    @click="term.sendKey(key.code)"
                    class="shrink-0 min-w-[3rem] px-3 py-1.5 bg-bg-hi hover:bg-bg-hi active:bg-bg-hi text-ink text-xs rounded border border-line-hi/60 transition-colors">
                    {{ key.label }}
                </button>
            </div>
            <div class="flex flex-wrap gap-1">
                <button v-for="key in CTRL_KEYS" :key="key.label"
                    @click="term.sendKey(key.code)"
                    class="shrink-0 min-w-[3rem] px-3 py-1.5 bg-bg-hi hover:bg-bg-hi active:bg-bg-hi text-ink text-xs rounded border border-line-hi/60 transition-colors">
                    {{ key.label }}
                </button>
            </div>
        </div>

        <div v-show="term.activeTab === 'commands'" class="px-2 py-2">
            <div v-if="snippets.snippets.length === 0" class="flex items-center justify-between gap-2 py-1">
                <span class="text-xs text-muted">先在下方输入框输入内容，再点 + 保存为常用命令</span>
                <button @click="emit('openAddSnippet')"
                    class="shrink-0 px-3 py-1.5 bg-bg-hi hover:bg-bg-hi text-ink text-xs rounded border border-dashed border-line-hi">
                    + 新增
                </button>
            </div>
            <div v-else class="flex flex-col gap-1">
                <button v-for="s in snippets.snippets" :key="s.id"
                    @click="onSnippetClick(s)"
                    @pointerdown="onPressStart(s)"
                    @pointerup="onPressEnd"
                    @pointerleave="onPressEnd"
                    @pointercancel="onPressEnd"
                    @contextmenu.prevent="emit('editSnippet', s)"
                    class="w-full truncate text-left px-3 py-1.5 bg-accent/18 hover:bg-accent/25 active:bg-accent/34 text-accent-hi text-xs rounded border border-accent/40 transition-colors">
                    {{ s.name }}
                </button>
                <button @click="emit('openAddSnippet')"
                    class="w-full px-2 py-1.5 bg-bg-hi hover:bg-bg-hi text-muted hover:text-ink text-xs rounded border border-dashed border-line-hi transition-colors"
                    title="新增常用命令">
                    +
                </button>
            </div>
        </div>
    </section>
</template>
