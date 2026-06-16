<script setup>
import { computed } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { fmtTime } from '@/apps/chat/lib/format';

const chat = useChatStore();
const emit = defineEmits(['close', 'newChat']);

const groups = computed(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = 86400000;
    const buckets = [
        { label: '今天', items: [] },
        { label: '最近 7 天', items: [] },
        { label: '更早', items: [] },
    ];
    for (const conversation of chat.conversations) {
        const ts = Number(conversation.updatedAt || 0);
        if (ts >= today) buckets[0].items.push(conversation);
        else if (ts >= today - day * 6) buckets[1].items.push(conversation);
        else buckets[2].items.push(conversation);
    }
    return buckets.filter((bucket) => bucket.items.length);
});

async function pickChat(id) {
    emit('close');
    await chat.openChat(id);
}

async function doRename(conversation) {
    const title = window.prompt('重命名对话', conversation.title || '');
    if (title != null && title.trim()) await chat.rename(conversation.id, title.trim());
}

async function doDelete(conversation) {
    if (window.confirm(`删除对话「${conversation.title || '未命名'}」？不可恢复。`)) {
        await chat.remove(conversation.id);
    }
}
</script>

<template>
    <aside class="hist-panel">
        <div class="hist-tools">
            <button class="hist-new" title="新建" @click="emit('newChat')">
                <span>＋</span>
                <b>新对话</b>
            </button>
        </div>

        <div class="hist-list">
            <div v-if="!chat.conversations.length" class="hist-empty">
                暂无对话记录
            </div>
            <template v-for="group in groups" :key="group.label">
                <div class="hist-group">{{ group.label }}</div>
                <div
                    v-for="conversation in group.items"
                    :key="conversation.id"
                    class="hist-row"
                    :class="{ on: conversation.id === chat.currentId }"
                    @click="pickChat(conversation.id)"
                >
                    <div class="hist-info">
                        <div class="hist-t">{{ conversation.title || '未命名' }}</div>
                        <div class="hist-m">{{ conversation.messageCount }} 条 · {{ fmtTime(conversation.updatedAt) }}</div>
                    </div>
                    <button class="hist-act" title="重命名" @click.stop="doRename(conversation)">✎</button>
                    <button class="hist-act danger" title="删除" @click.stop="doDelete(conversation)">✕</button>
                </div>
            </template>
        </div>
    </aside>
</template>

<style scoped>
.hist-panel {
    display: flex;
    min-height: 0;
    height: 100%;
    flex-direction: column;
    background: var(--color-bg-elev);
    border-right: 1px solid var(--line);
    overflow: hidden;
}
.hist-tools {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    gap: 4px;
    padding: 12px 10px 8px;
}
.hist-new {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 36px;
    border-radius: 9px;
    padding: 0 10px;
    color: var(--color-muted);
    font-size: 13.5px;
    text-align: left;
    transition: background 0.12s ease, color 0.12s ease;
}
.hist-new span {
    width: 16px;
    color: var(--color-faint);
    font-size: 18px;
    line-height: 1;
}
.hist-new b { font-weight: 650; }
.hist-new:hover {
    background: color-mix(in srgb, var(--color-ink) 6%, transparent);
    color: var(--color-ink);
}
.hist-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 10px 14px;
    scrollbar-width: none;
}
.hist-list::-webkit-scrollbar { display: none; }
.hist-empty {
    color: var(--color-faint);
    font-size: 12.5px;
    text-align: center;
    padding: 48px 0;
}
.hist-group {
    margin-top: 18px;
    padding: 0 10px 6px;
    color: var(--color-muted);
    font-size: 12px;
    font-weight: 650;
}
.hist-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 7px 8px 7px 10px;
    border-radius: 9px;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
}
.hist-row:hover,
.hist-row.on {
    background: color-mix(in srgb, var(--color-ink) 6%, transparent);
}
.hist-info { flex: 1; min-width: 0; }
.hist-t {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.hist-m { font-size: 11px; color: var(--color-faint); margin-top: 2px; }
.hist-act {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    color: var(--color-muted);
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.12s, background 0.12s, color 0.12s;
}
.hist-row:hover .hist-act { opacity: 1; }
.hist-act:hover { background: var(--well); color: var(--color-ink); }
.hist-act.danger:hover { background: var(--bad-soft); color: var(--bad); }
</style>
