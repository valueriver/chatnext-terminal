<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChatStore } from '@/apps/chat/store';
import { useWsStore } from '@/system/stores/ws';
import ChatHeader from './components/ChatHeader.vue';
import Composer from './components/Composer.vue';
import HistoryPanel from './components/HistoryPanel.vue';
import MessageStream from './components/MessageStream.vue';

const chat = useChatStore();
const ws = useWsStore();
const route = useRoute();
const router = useRouter();
const showHistory = ref(false);

// 路由驱动:/chat/:id 打开该对话;/chat 为空白新对话
function syncFromRoute() {
    const id = route.params.id;
    if (id) { if (chat.currentId !== id) chat.openChat(id); }
    else { chat.newChat(); }
}

function newChat() {
    showHistory.value = false;
    if (route.params.id) router.push('/chat'); else chat.newChat();
}

onMounted(() => {
    chat.bind();
    chat.refresh();
    syncFromRoute();
});

watch(() => route.params.id, syncFromRoute);
// 首条消息建好对话后,URL 跟上(/chat → /chat/:id)
watch(() => chat.currentId, (id) => {
    if (id && route.params.id !== id) router.replace(`/chat/${id}`);
});
watch(() => ws.connected, (ok) => { if (ok) chat.refresh(); });
</script>

<template>
    <section class="view">
        <ChatHeader
            :title="chat.currentTitle || '对话'"
            :history-open="showHistory"
            @toggleHistory="showHistory = !showHistory"
        />
        <div class="chat-body">
            <HistoryPanel
                v-if="showHistory"
                class="chat-side"
                @close="showHistory = false"
                @newChat="newChat"
            />
            <div v-if="showHistory" class="chat-side-mask" @click="showHistory = false"></div>
            <div class="chat-main">
                <MessageStream />
                <Composer />
            </div>
        </div>
    </section>
</template>

<style scoped>
.chat-body {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--color-bg);
}
.chat-side {
    width: 304px;
    flex-shrink: 0;
}
.chat-main {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex: 1;
    flex-direction: column;
}
.chat-side-mask { display: none; }

@media (max-width: 768px) {
    .chat-side {
        position: absolute;
        inset: 0 auto 0 0;
        z-index: 30;
        width: min(320px, 86vw);
        box-shadow: 18px 0 44px #00000024;
        animation: side-in 0.18s ease;
    }
    .chat-side-mask {
        position: absolute;
        inset: 0;
        z-index: 25;
        display: block;
        background: #0000002e;
    }
}

@keyframes side-in {
    from { opacity: 0; transform: translateX(-18px); }
}
</style>
