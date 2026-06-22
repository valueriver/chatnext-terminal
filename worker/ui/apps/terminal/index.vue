<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import { useTerminalStore } from '@/apps/terminal/store';
import { useSnippetsStore } from '@/apps/terminal/snippets';
import TerminalToolbar from '@/apps/terminal/components/TerminalToolbar.vue';
import BottomPanel from '@/apps/terminal/components/BottomPanel.vue';
import InputBar from '@/apps/terminal/components/InputBar.vue';
import SnippetModal from '@/apps/terminal/components/SnippetModal.vue';
import DeviceOffline from '@/system/components/DeviceOffline.vue';

const ws = useWsStore();
const term = useTerminalStore();
const snippets = useSnippetsStore();

const inputBarRef = ref(null);
const handleResize = () => term.fitActiveTerminal();

const showModal = ref(false);
const editingId = ref(null);
const initialName = ref('');
const initialCmd = ref('');
const initialAutoSend = ref(true);

function openAdd() {
    editingId.value = null;
    initialName.value = '';
    initialCmd.value = term.inputText || '';
    initialAutoSend.value = false;
    showModal.value = true;
}

function openEdit(s) {
    editingId.value = s.id;
    initialName.value = s.name;
    initialCmd.value = s.command;
    initialAutoSend.value = s.autoSend !== false;
    showModal.value = true;
}

function runSnippet(s) {
    if (s.autoSend) {
        term.sendInputRaw(s.command + '\r');
    } else {
        term.inputText = s.command;
        nextTick(() => inputBarRef.value?.focus());
    }
}

function setTerminalContainer(terminalId, el) {
    if (el) term.mountTerminal(terminalId, el);
}

watch([() => term.showPanel, () => term.activeTab, () => snippets.snippets.length, () => ws.connected], () => {
    setTimeout(term.fitActiveTerminal, 60);
});

watch(() => term.activeTerminalId, () => {
    setTimeout(term.fitActiveTerminal, 30);
});

onMounted(() => {
    term.initialize();
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    window.visualViewport?.removeEventListener('resize', handleResize);
});
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col">
        <TerminalToolbar />

        <DeviceOffline v-if="!ws.deviceOnline" />
        <template v-else>
            <div class="relative min-h-0 flex-1 bg-bg">
                <main
                    v-for="tab in term.terminalTabs"
                    :key="tab.id"
                    v-show="tab.id === term.activeTerminalId"
                    :ref="(el) => setTerminalContainer(tab.id, el)"
                    class="h-full w-full overflow-hidden bg-bg"
                ></main>

                <div v-if="!term.terminalTabs.length" class="flex h-full items-center justify-center text-sm text-muted">
                    等待终端列表...
                </div>
            </div>

            <BottomPanel v-show="ws.connected && term.showPanel"
                @openAddSnippet="openAdd"
                @editSnippet="openEdit"
                @runSnippet="runSnippet" />

            <InputBar v-show="ws.connected" ref="inputBarRef" />
        </template>

        <SnippetModal
            :open="showModal"
            :editingId="editingId"
            :initialName="initialName"
            :initialCmd="initialCmd"
            :initialAutoSend="initialAutoSend"
            @close="showModal = false" />
    </div>
</template>
