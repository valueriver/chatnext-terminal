<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useThemeStore } from '@/system/stores/theme';
import { useModelStore } from '@/apps/settings/store';
import { useShortcutsStore } from '@/system/stores/shortcuts';
import { useWsStore } from '@/system/stores/ws';
import { logout } from '@/system/api';
import SettingsHeader from '../components/SettingsHeader.vue';

const theme = useThemeStore();
const model = useModelStore();
const shortcuts = useShortcutsStore();
const ws = useWsStore();

// —— 快捷指令管理 ——
const scDraft = ref('');
const scEditId = ref(null);
const scEditText = ref('');
async function scAdd() {
    const t = scDraft.value.trim();
    if (!t || !ws.connected) return;
    await shortcuts.save({ text: t });
    scDraft.value = '';
}
function scStartEdit(s) { scEditId.value = s.id; scEditText.value = s.text; }
async function scCommitEdit() {
    const t = scEditText.value.trim();
    if (t) await shortcuts.save({ id: scEditId.value, text: t });
    scEditId.value = null;
}
async function scDel(s) { if (ws.connected) await shortcuts.remove(s.id); }
async function scMove(i, dir) {
    const arr = shortcuts.items.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await shortcuts.reorder(arr);
}

const form = reactive({ apiUrl: '', apiKey: '', model: '', compressThreshold: '12000', toolResultMaxChars: '12000', compactPrompt: '' });
const saved = ref(false);
const saving = ref(false);

// 服务器只回掩码，不回明文 key
const keyMasked = computed(() => model.config.keyPreview || (model.config.hasKey ? '已设置' : '未设置'));

const dirty = computed(() =>
    form.apiUrl !== (model.config.apiUrl || '') ||
    form.model !== (model.config.model || '') ||
    form.apiKey.trim().length > 0 ||
    String(form.compressThreshold) !== String(model.config.compressThreshold ?? 12000) ||
    String(form.toolResultMaxChars) !== String(model.config.toolResultMaxChars ?? 12000) ||
    form.compactPrompt !== (model.config.compactPrompt || '')
);

function syncFromServer() {
    const c = model.config;
    form.apiUrl = c.apiUrl || '';
    form.model = c.model || '';
    form.apiKey = ''; // 不回填明文，留空＝不改
    form.compressThreshold = String(c.compressThreshold ?? 12000);
    form.toolResultMaxChars = String(c.toolResultMaxChars ?? 12000);
    form.compactPrompt = c.compactPrompt || '';
}

async function load() {
    if (!ws.connected) return;
    await model.load();
    await shortcuts.load();
    syncFromServer();
}
async function save() {
    if (!ws.connected || saving.value || !dirty.value) return;
    saving.value = true;
    const patch = {
        apiUrl: String(form.apiUrl).trim(),
        model: String(form.model).trim(),
        compressThreshold: String(Number(form.compressThreshold) || 12000),
        toolResultMaxChars: String(Number(form.toolResultMaxChars) || 12000),
        compactPrompt: String(form.compactPrompt),
    };
    if (form.apiKey.trim()) patch.apiKey = form.apiKey.trim();
    await model.save(patch);
    syncFromServer();
    saving.value = false;
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 1800);
}
function reset() { syncFromServer(); }

onMounted(load);
watch(() => ws.connected, (v) => { if (v) load(); });
</script>

<template>
    <section class="view">
        <SettingsHeader />
        <div class="page-wrap">
            <div class="page-inner">
                <!-- 外观 -->
                <div class="set-group">
                    <div class="set-title">外观</div>
                    <div class="set-card">
                        <div class="set-row">
                            <span class="set-k">主题</span>
                            <div class="switch">
                                <button class="sw" :class="{ on: theme.theme === 'sky' }" @click="theme.setTheme('sky')">🌤 晴空</button>
                                <button class="sw" :class="{ on: theme.theme === 'night' }" @click="theme.setTheme('night')">🌙 谧夜</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 模型设置 -->
                <div class="set-group">
                    <div class="set-title">模型设置</div>
                    <div class="set-card">
                        <div class="set-row">
                            <span class="set-k">API 地址</span>
                            <input class="set-input" v-model="form.apiUrl" :disabled="!ws.connected" placeholder="https://api.openai.com/v1" spellcheck="false" autocapitalize="off" />
                        </div>
                        <div class="set-row">
                            <span class="set-k">API Key</span>
                            <input class="set-input" v-model="form.apiKey" type="password" :disabled="!ws.connected" :placeholder="keyMasked" autocomplete="off" spellcheck="false" />
                        </div>
                        <div class="set-row">
                            <span class="set-k">模型</span>
                            <input class="set-input" v-model="form.model" :disabled="!ws.connected" placeholder="gpt-4o" spellcheck="false" autocapitalize="off" />
                        </div>
                    </div>
                    <div class="set-note">配置存在云端，AI 对话用它调用 OpenAI 兼容接口。Key 留空＝不改。</div>
                </div>

                <!-- 对话压缩 -->
                <div class="set-group">
                    <div class="set-title">对话压缩</div>
                    <div class="set-card">
                        <div class="set-row set-row-col">
                            <span class="set-k">压缩阈值（tokens）</span>
                            <input class="set-input" v-model="form.compressThreshold" type="number" :disabled="!ws.connected" placeholder="12000" />
                        </div>
                        <div class="set-row set-row-col">
                            <span class="set-k">工具结果上限（字符）</span>
                            <input class="set-input" v-model="form.toolResultMaxChars" type="number" :disabled="!ws.connected" placeholder="12000" />
                        </div>
                        <div class="set-row set-row-col">
                            <span class="set-k">压缩提示词</span>
                            <textarea class="set-input set-textarea" v-model="form.compactPrompt" :disabled="!ws.connected" rows="5" placeholder="留空＝使用内置默认压缩提示词" spellcheck="false"></textarea>
                        </div>
                    </div>
                    <div class="set-note">上下文超「压缩阈值」时自动把较早消息摘要成一条；工具结果超「上限」会截断。</div>
                </div>

                <!-- 模型 / 压缩 的保存 -->
                <div class="set-actions">
                    <button class="cta" :disabled="!ws.connected || !dirty || saving" @click="save">{{ saved ? '已保存 ✓' : (saving ? '保存中…' : '保存') }}</button>
                    <button class="set-act" :disabled="!dirty || saving" @click="reset">重置</button>
                </div>

                <!-- 快捷指令 -->
                <div class="set-group">
                    <div class="set-title">快捷指令</div>
                    <div class="set-card">
                        <div class="set-row">
                            <input class="set-input" v-model="scDraft" :disabled="!ws.connected" placeholder="新增一条快捷指令…" spellcheck="false" @keydown.enter="scAdd" />
                            <button class="set-act" :disabled="!ws.connected || !scDraft.trim()" @click="scAdd">添加</button>
                        </div>
                        <div v-for="(s, i) in shortcuts.items" :key="s.id" class="set-row gap-2">
                            <template v-if="scEditId === s.id">
                                <input class="set-input" v-model="scEditText" spellcheck="false" @keydown.enter="scCommitEdit" />
                                <button class="set-act" @click="scCommitEdit">保存</button>
                            </template>
                            <template v-else>
                                <span class="flex-1 min-w-0 text-[13.5px] text-ink truncate">{{ s.text }}</span>
                                <button class="text-faint hover:text-ink text-[15px] disabled:opacity-30 px-1" :disabled="i === 0" title="上移" @click="scMove(i, -1)">↑</button>
                                <button class="text-faint hover:text-ink text-[15px] disabled:opacity-30 px-1" :disabled="i === shortcuts.items.length - 1" title="下移" @click="scMove(i, 1)">↓</button>
                                <button class="text-faint hover:text-ink text-[12px] px-1" title="编辑" @click="scStartEdit(s)">改</button>
                                <button class="text-faint hover:text-bad text-[12px] px-1" title="删除" @click="scDel(s)">删</button>
                            </template>
                        </div>
                    </div>
                    <div class="set-note">聊天输入框「+」面板里的常用语，点一下填进输入框。改动即时生效。</div>
                </div>

                <!-- 账户 -->
                <div class="set-group">
                    <div class="set-title">账户</div>
                    <div class="set-card">
                        <div class="set-row">
                            <span class="set-k">连接</span>
                            <span class="set-v">{{ ws.statusText }}</span>
                        </div>
                    </div>
                    <div class="set-actions">
                        <button class="set-act danger" @click="logout">退出登录</button>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.set-actions { display: flex; gap: 10px; align-items: center; margin: 14px 6px 0; }
.set-act.danger { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 40%, transparent); }
.set-act.danger:hover { background: color-mix(in srgb, var(--bad) 12%, transparent); }
</style>
