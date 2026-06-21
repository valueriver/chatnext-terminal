<script setup>
import { ref, watch } from 'vue';
import { useSnippetsStore, MAX_SNIPPETS } from '@/apps/terminal/snippets';
import { useToastStore } from '@/system/stores/toast';
import { useTerminalStore } from '@/apps/terminal/store';

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
        <div class="sheet-enter sm:animate-none w-full sm:max-w-md bg-bg-elev border border-line rounded-t-2xl sm:rounded-2xl p-4 space-y-4 safe-bottom">
            <div class="flex items-center justify-between">
                <h3 class="text-base font-medium text-ink">{{ editingId ? '编辑常用命令' : '新增常用命令' }}</h3>
                <button @click="emit('close')"
                    class="w-8 h-8 flex items-center justify-center text-muted hover:text-ink hover:bg-bg-hi rounded transition-colors">
                    ✕
                </button>
            </div>

            <div class="space-y-1.5">
                <label class="block text-xs text-muted">名称（按钮上显示）</label>
                <input v-model="formName"
                    placeholder="如：部署"
                    maxlength="20"
                    class="w-full px-3 h-10 bg-bg-hi text-ink placeholder:text-faint border border-line-hi rounded focus:outline-none focus:border-accent" />
            </div>

            <div class="space-y-1.5">
                <label class="block text-xs text-muted">命令内容</label>
                <textarea v-model="formCmd"
                    placeholder="如：npm run deploy"
                    rows="3"
                    spellcheck="false"
                    autocapitalize="off"
                    autocorrect="off"
                    class="w-full px-3 py-2 bg-bg-hi text-ink placeholder:text-faint border border-line-hi rounded focus:outline-none focus:border-accent resize-none"></textarea>
            </div>

            <label class="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input v-model="formAutoSend" type="checkbox" class="w-4 h-4 accent-accent" />
                点击后直接发送（带回车）。取消则只填到输入框
            </label>

            <div class="flex items-center gap-2 pt-1">
                <button v-if="editingId" @click="remove"
                    class="px-3 h-10 bg-bad/18 hover:bg-bad/32 text-bad text-sm rounded border border-bad/50 transition-colors">
                    删除
                </button>
                <div class="flex gap-2 ml-auto">
                    <button @click="emit('close')"
                        class="px-4 h-10 bg-bg-hi hover:bg-bg-hi text-ink text-sm rounded border border-line-hi transition-colors">
                        取消
                    </button>
                    <button @click="save"
                        :disabled="!formName.trim() || !formCmd"
                        class="px-4 h-10 bg-accent hover:bg-accent-hi disabled:bg-bg-hi disabled:text-faint text-white text-sm font-medium rounded transition-colors">
                        保存
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
