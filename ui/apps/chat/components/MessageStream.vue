<script setup>
import { computed, nextTick, onActivated, ref, watch } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { renderMd } from '@/apps/chat/lib/format';
import { isToolRow } from '@/apps/chat/lib/messages';
import ToolGroup from './ToolGroup.vue';

const chat = useChatStore();
const streamRef = ref(null);

const showTyping = computed(() => {
    if (!chat.busy) return false;
    const last = chat.messages[chat.messages.length - 1];
    return !(last && last.role === 'assistant' && last.streaming);
});

const blocks = computed(() => {
    const out = [];
    for (const message of chat.messages) {
        if (isToolRow(message)) {
            const last = out[out.length - 1];
            if (last?.kind === 'tools') {
                last.items.push(message);
            } else {
                out.push({ kind: 'tools', key: `tools:${message._key}`, items: [message] });
            }
            continue;
        }
        out.push({ kind: 'message', key: message._key, message });
    }
    return out;
});

function isPinned() {
    const el = streamRef.value;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
}

function toBottom() {
    nextTick(() => requestAnimationFrame(() => {
        const el = streamRef.value;
        if (el) el.scrollTop = el.scrollHeight;
    }));
}

watch(() => chat.viewSeq, toBottom);
watch(() => chat.streamTick, () => {
    if (isPinned()) toBottom();
});
onActivated(toBottom);

async function onScroll() {
    const el = streamRef.value;
    if (!el || chat.loadingOlder || !chat.hasMore) return;
    if (el.scrollTop > 48) return;
    const prevH = el.scrollHeight;
    const prevTop = el.scrollTop;
    const count = await chat.loadOlder();
    if (!count) return;
    await nextTick();
    requestAnimationFrame(() => { el.scrollTop = prevTop + (el.scrollHeight - prevH); });
}
</script>

<template>
    <div ref="streamRef" class="stream" @scroll.passive="onScroll">
        <div class="thread">
            <div v-if="chat.loadingOlder" class="load-older">加载更早…</div>
            <div v-else-if="chat.hasMore && chat.messages.length" class="load-older hint">↑ 上滑加载更早</div>

            <div v-if="!chat.messages.length" class="hero">
                <h1>Roam <em>助手</em></h1>
                <div class="cap">本机 AI 对话，可执行命令、操作浏览器与电脑。直接说你想做什么。</div>
            </div>

            <template v-for="block in blocks" :key="block.key">
                <ToolGroup v-if="block.kind === 'tools'" :items="block.items" />

                <div v-else-if="block.message.role === 'user'" class="mrow me">
                    <div class="bubble me">
                        <div v-if="block.message.attachments?.length" class="flex flex-wrap gap-1.5 justify-end" :class="block.message.content ? 'mb-1.5' : ''">
                            <span v-for="(f, i) in block.message.attachments" :key="i" class="inline-flex items-center gap-1.5 max-w-[200px] rounded-[10px] border border-white/30 bg-white/15 px-2 py-1">
                                <span class="text-[11px]">📎</span>
                                <span class="truncate text-[11px] font-semibold">{{ f.name }}</span>
                            </span>
                        </div>
                        <template v-if="block.message.content">{{ block.message.content }}</template>
                    </div>
                </div>

                <div v-else-if="block.message.role === 'assistant'" class="mrow">
                    <div class="avatar">AI</div>
                    <div class="bubble ai">
                        <div class="ai-text" v-html="renderMd(block.message.content)"></div>
                        <div v-if="block.message.usage" class="usage-line">prompt {{ block.message.usage.prompt_tokens ?? '?' }} · completion {{ block.message.usage.completion_tokens ?? '?' }}</div>
                    </div>
                </div>

                <div v-else-if="block.message.type === 'shot'" class="shot-row">
                    <img :src="block.message.dataUrl" alt="屏幕截图" />
                </div>

                <div v-else-if="block.message.role === 'system'" class="system-event">
                    <span>{{ block.message.content }}</span>
                </div>
            </template>

            <div v-if="showTyping" class="mrow">
                <div class="avatar">AI</div>
                <div class="bubble ai typing"><i></i><i></i><i></i></div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.load-older { text-align: center; font-size: 11.5px; color: var(--muted); padding: 6px 0 10px; }
.load-older.hint { opacity: 0.6; }
.shot-row { display: flex; justify-content: center; margin: 8px 0; }
.shot-row img {
    max-width: 92%;
    border-radius: 14px;
    box-shadow: 0 6px 20px #00000022;
    border: 1px solid var(--line);
}
</style>
