<script setup>
import { ref, watch } from 'vue';
import { useSnippetsStore, MAX_SNIPPETS } from '@/stores/snippets';
import { useToastStore } from '@/stores/toast';
import { useTerminalStore } from '@/stores/terminal';

const props = defineProps({
    open: Boolean,
    editingId: { type: String, default: null },
    initialName: { type: String, default: '' },
    initialCmd: { type: String, default: '' },
    initialAutoSend: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);

const snippets = useSnippetsStore();
const toast = useToastStore();
const term = useTerminalStore();

const formName = ref(props.initialName);
const formCmd = ref(props.initialCmd);
const formAutoSend = ref(props.initialAutoSend);

watch(() => props.open, (v) => {
    if (v) {
        formName.value = props.initialName;
        formCmd.value = props.initialCmd;
        formAutoSend.value = props.initialAutoSend;
    }
});

function save() {
    const name = formName.value.trim();
    const command = formCmd.value;
    if (!name || !command) return;
    if (props.editingId) {
        snippets.update(props.editingId, { name, command, autoSend: formAutoSend.value });
        toast.show('已保存');
    } else {
        if (!snippets.add({ name, command, autoSend: formAutoSend.value })) {
            toast.show(`最多保存 ${MAX_SNIPPETS} 条`);
            return;
        }
        toast.show('已新增');
    }
    term.setTab('commands');
    emit('close');
}

function remove() {
    if (!props.editingId) return;
    snippets.remove(props.editingId);
    toast.show('已删除');
    emit('close');
}
</script>

<template>
    <div v-if="open"
        class="fade-enter fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="emit('close')">
        <div class="sheet-enter sm:animate-none w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-4 space-y-4 safe-bottom">
            <div class="flex items-center justify-between">
                <h3 class="text-base font-medium text-zinc-100">{{ editingId ? '编辑常用命令' : '新增常用命令' }}</h3>
                <button @click="emit('close')"
                    class="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                    ✕
                </button>
            </div>

            <div class="space-y-1.5">
                <label class="block text-xs text-zinc-400">名称（按钮上显示）</label>
                <input v-model="formName"
                    placeholder="如：部署"
                    maxlength="20"
                    class="w-full px-3 h-10 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded focus:outline-none focus:border-emerald-500" />
            </div>

            <div class="space-y-1.5">
                <label class="block text-xs text-zinc-400">命令内容</label>
                <textarea v-model="formCmd"
                    placeholder="如：npm run deploy"
                    rows="3"
                    spellcheck="false"
                    autocapitalize="off"
                    autocorrect="off"
                    class="w-full px-3 py-2 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 rounded focus:outline-none focus:border-emerald-500 resize-none"></textarea>
            </div>

            <label class="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input v-model="formAutoSend" type="checkbox" class="w-4 h-4 accent-emerald-500" />
                点击后直接发送（带回车）。取消则只填到输入框
            </label>

            <div class="flex items-center gap-2 pt-1">
                <button v-if="editingId" @click="remove"
                    class="px-3 h-10 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm rounded border border-red-900/60 transition-colors">
                    删除
                </button>
                <div class="flex gap-2 ml-auto">
                    <button @click="emit('close')"
                        class="px-4 h-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded border border-zinc-700 transition-colors">
                        取消
                    </button>
                    <button @click="save"
                        :disabled="!formName.trim() || !formCmd"
                        class="px-4 h-10 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded transition-colors">
                        保存
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
