<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { useWsStore } from '@/system/stores/ws';
import { useShortcutsStore } from '@/apps/shortcuts/store';

const chat = useChatStore();
const ws = useWsStore();
const shortcuts = useShortcutsStore();
const input = ref('');
const atts = ref([]); // [{name, path, size}]
const uploading = ref(false);
const taRef = ref(null);
const fileRef = ref(null);
const panelOpen = ref(false);

const canSend = computed(() => ws.showActions && !chat.busy && !uploading.value && (input.value.trim().length > 0 || atts.value.length > 0));

function onKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        send();
    }
}

function send() {
    if (!canSend.value) return;
    const text = input.value;
    const files = atts.value.slice();
    input.value = '';
    atts.value = [];
    if (taRef.value) taRef.value.style.height = 'auto';
    chat.send(text, files);
}

function autoGrow(event) {
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

function pickShortcut(s) {
    input.value = input.value ? `${input.value}${input.value.endsWith(' ') ? '' : ' '}${s.text}` : s.text;
    panelOpen.value = false;
    taRef.value?.focus();
}

// 上传：文件 → data URL → WS attach.upload → 拿回 {name, path, size}（落本机 ~/.roam/files）。
let bound = false;
let seq = 0;
const pending = new Map();
function bindUpload() {
    if (bound) return;
    bound = true;
    ws.onMessage('attach.upload.result', (msg) => {
        const d = msg.data || {};
        const r = d.reqId && pending.get(d.reqId);
        if (r) { pending.delete(d.reqId); r(d); }
    });
}
function uploadOne(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const reqId = `up${Date.now()}_${seq++}`;
            pending.set(reqId, resolve);
            const ok = ws.sendMsg({ type: 'attach.upload', to: 'desktop', data: { name: file.name, dataUrl: String(reader.result), reqId } });
            if (!ok) { pending.delete(reqId); resolve(null); return; }
            setTimeout(() => { if (pending.has(reqId)) { pending.delete(reqId); resolve(null); } }, 30000);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

function openFile() { panelOpen.value = false; fileRef.value?.click(); }
async function onFiles(event) {
    bindUpload();
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    uploading.value = true;
    for (const f of files) {
        if (atts.value.length >= 10) break;
        const d = await uploadOne(f);
        if (d?.ok && d.path) atts.value = [...atts.value, { name: d.name, path: d.path, size: d.size }];
    }
    uploading.value = false;
}
function removeAtt(i) { atts.value = atts.value.filter((_, idx) => idx !== i); }

function loadShortcuts() { if (ws.showActions) shortcuts.load(); }
onMounted(loadShortcuts);
watch(() => ws.showActions, (v) => { if (v) loadShortcuts(); });
watch(panelOpen, (v) => { if (v) loadShortcuts(); });
</script>

<template>
    <div class="composer">
        <!-- 附件预览 -->
        <div v-if="atts.length || uploading" class="max-w-[720px] mx-auto flex flex-wrap gap-2 mb-2 px-1">
            <div v-for="(f, i) in atts" :key="i" class="inline-flex items-center gap-1.5 max-w-[220px] rounded-[10px] border border-line bg-bg-elev px-2.5 py-1.5">
                <span class="text-[13px]">📎</span>
                <span class="truncate text-[12px] font-semibold text-ink">{{ f.name }}</span>
                <button class="text-faint hover:text-bad text-[11px] shrink-0" @click="removeAtt(i)">✕</button>
            </div>
            <span v-if="uploading" class="inline-flex items-center text-[12px] text-faint px-2 py-1.5">上传中…</span>
        </div>

        <div class="inputwrap">
            <!-- + 面板 -->
            <div class="relative shrink-0">
                <button
                    class="w-9 h-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-bg-hi transition disabled:opacity-40"
                    :class="panelOpen ? 'text-accent bg-bg-hi' : ''"
                    :disabled="!ws.showActions"
                    title="更多"
                    @click="panelOpen = !panelOpen"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>

                <template v-if="panelOpen">
                    <div class="fixed inset-0 z-40" @click="panelOpen = false"></div>
                    <div class="absolute bottom-[calc(100%+10px)] left-0 z-50 w-[min(320px,calc(100vw-32px))] rounded-2xl border border-line bg-bg-elev shadow-[0_18px_50px_#00000028] p-2">
                        <!-- 快捷指令 -->
                        <div class="px-2 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-faint">快捷指令</div>
                        <div v-if="shortcuts.items.length" class="flex flex-col gap-0.5 max-h-52 overflow-y-auto">
                            <button
                                v-for="s in shortcuts.items"
                                :key="s.id"
                                class="text-left px-2.5 py-2 rounded-lg text-[13.5px] text-ink hover:bg-bg-hi transition truncate"
                                @click="pickShortcut(s)"
                            >{{ s.text }}</button>
                        </div>
                        <div v-else class="px-2.5 py-2 text-[12.5px] text-faint">还没有快捷指令，去设置里添加。</div>

                        <!-- 添加附件 -->
                        <div class="mt-1.5 pt-1.5 border-t border-line">
                            <button class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-ink hover:bg-bg-hi transition" @click="openFile">
                                <span class="text-[16px]">📎</span>添加附件
                            </button>
                        </div>
                    </div>
                </template>
            </div>

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

        <input ref="fileRef" type="file" multiple class="hidden" @change="onFiles" />
    </div>
</template>

<style scoped>
.sendbtn.stop {
    background: var(--bad);
    box-shadow: 0 5px 12px #00000028;
    font-size: 12px;
}
</style>
