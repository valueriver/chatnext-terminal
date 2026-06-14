<script setup>
import { computed, ref } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { useWsStore } from '@/system/stores/ws';

const chat = useChatStore();
const ws = useWsStore();
const input = ref('');
const taRef = ref(null);

const canSend = computed(() => ws.showActions && !chat.busy && input.value.trim().length > 0);

function onKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        send();
    }
}

function send() {
    if (!canSend.value) return;
    const text = input.value;
    input.value = '';
    if (taRef.value) taRef.value.style.height = 'auto';
    chat.send(text);
}

function autoGrow(event) {
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}
</script>

<template>
    <div class="composer">
        <div class="inputwrap">
            <textarea
                ref="taRef"
                v-model="input"
                rows="1"
                :placeholder="ws.showActions ? '发消息，回车发送，Shift+回车换行' : '等待连接…'"
                :disabled="!ws.showActions"
                @keydown="onKeydown"
                @input="autoGrow"
            ></textarea>
            <button v-if="chat.busy" class="sendbtn stop" title="停止" @click="chat.abort()">■</button>
            <button v-else class="sendbtn" :disabled="!canSend" title="发送" @click="send">↑</button>
        </div>
    </div>
</template>

<style scoped>
.sendbtn.stop {
    background: var(--bad);
    box-shadow: 0 5px 12px #00000028;
    font-size: 12px;
}
</style>
