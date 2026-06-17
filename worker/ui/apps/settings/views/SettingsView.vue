<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useThemeStore } from '@/system/stores/theme';
import { useModelStore } from '@/apps/settings/store';
import { useShortcutsStore } from '@/apps/shortcuts/store';
import { useWsStore } from '@/system/stores/ws';
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
    if (!t || !ws.showActions) return;
    await shortcuts.save({ text: t });
    scDraft.value = '';
}
function scStartEdit(s) { scEditId.value = s.id; scEditText.value = s.text; }
async function scCommitEdit() {
    const t = scEditText.value.trim();
    if (t) await shortcuts.save({ id: scEditId.value, text: t });
    scEditId.value = null;
}
async function scDel(s) { if (ws.showActions) await shortcuts.remove(s.id); }
async function scMove(i, dir) {
    const arr = shortcuts.items.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await shortcuts.reorder(arr);
}

const form = reactive({ baseUrl: '', apiKey: '', model: '', compressThreshold: '12000', toolResultMaxChars: '12000', compactPrompt: '', upgradeTime: '07:00' });
const saved = ref(false);
const saving = ref(false);

// 服务器只回掩码，不回明文 key
const keyMasked = computed(() => model.config.keyPreview || (model.config.hasKey ? '已设置' : '未设置'));

const dirty = computed(() =>
    form.baseUrl !== (model.config.baseUrl || '') ||
    form.model !== (model.config.model || '') ||
    form.apiKey.trim().length > 0 ||
    String(form.compressThreshold) !== String(model.config.compressThreshold ?? 12000) ||
    String(form.toolResultMaxChars) !== String(model.config.toolResultMaxChars ?? 12000) ||
    form.compactPrompt !== (model.config.compactPrompt || '') ||
    form.upgradeTime !== (model.config.upgradeTime || '07:00')
);

function syncFromServer() {
    const c = model.config;
    form.baseUrl = c.baseUrl || '';
    form.model = c.model || '';
    form.apiKey = ''; // 不回填明文，留空＝不改
    form.compressThreshold = String(c.compressThreshold ?? 12000);
    form.toolResultMaxChars = String(c.toolResultMaxChars ?? 12000);
    form.compactPrompt = c.compactPrompt || '';
    form.upgradeTime = c.upgradeTime || '07:00';
}

async function load() {
    if (!ws.showActions) return;
    await model.load();
    await shortcuts.load();
    syncFromServer();
}
async function save() {
    if (!ws.showActions || saving.value || !dirty.value) return;
    saving.value = true;
    const patch = {
        baseUrl: String(form.baseUrl).trim(),
        model: String(form.model).trim(),
        compressThreshold: String(Number(form.compressThreshold) || 12000),
        toolResultMaxChars: String(Number(form.toolResultMaxChars) || 12000),
        compactPrompt: String(form.compactPrompt),
        upgradeTime: /^\d{2}:\d{2}$/.test(form.upgradeTime) ? form.upgradeTime : '07:00',
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
watch(() => ws.showActions, (v) => { if (v) load(); });
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
                            <input class="set-input" v-model="form.baseUrl" :disabled="!ws.showActions" placeholder="https://api.openai.com/v1" spellcheck="false" autocapitalize="off" />
                        </div>
                        <div class="set-row">
                            <span class="set-k">API Key</span>
                            <input class="set-input" v-model="form.apiKey" type="password" :disabled="!ws.showActions" :placeholder="keyMasked" autocomplete="off" spellcheck="false" />
                        </div>
                        <div class="set-row">
                            <span class="set-k">模型</span>
                            <input class="set-input" v-model="form.model" :disabled="!ws.showActions" placeholder="gpt-4o" spellcheck="false" autocapitalize="off" />
                        </div>
                    </div>
                    <div class="set-note">
                        <template v-if="ws.showActions">配置保存在本机 Server（~/.roam/roam.db），AI 对话直接用它调用 OpenAI 兼容接口。当前 Key：{{ keyMasked }}。Key 留空＝不修改。</template>
                        <template v-else>未连接本机 Server，无法读写模型配置。请先在守卫页完成连接/认证。</template>
                    </div>
                </div>

                <!-- 对话压缩 -->
                <div class="set-group">
                    <div class="set-title">对话压缩</div>
                    <div class="set-card">
                        <div class="set-row">
                            <span class="set-k">压缩阈值（tokens）</span>
                            <input class="set-input" v-model="form.compressThreshold" type="number" :disabled="!ws.showActions" placeholder="12000" />
                        </div>
                        <div class="set-row">
                            <span class="set-k">工具结果上限（字符）</span>
                            <input class="set-input" v-model="form.toolResultMaxChars" type="number" :disabled="!ws.showActions" placeholder="12000" />
                        </div>
                        <div class="set-row set-row-col">
                            <span class="set-k">压缩提示词</span>
                            <textarea class="set-input set-textarea" v-model="form.compactPrompt" :disabled="!ws.showActions" rows="5" placeholder="留空＝使用内置默认压缩提示词" spellcheck="false"></textarea>
                        </div>
                    </div>
                    <div class="set-note">
                        上下文累计 token 超过「压缩阈值」时，自动用模型把较早的消息摘要成一条，之后只带摘要继续对话。工具返回超「上限」的部分会截断，避免撑爆上下文。
                    </div>
                </div>

                <!-- 启示 -->
                <div class="set-group">
                    <div class="set-title">启示</div>
                    <div class="set-card">
                        <div class="set-row">
                            <span class="set-k">每日时间</span>
                            <input class="set-input" v-model="form.upgradeTime" type="time" :disabled="!ws.showActions" />
                        </div>
                    </div>
                    <div class="set-note">
                        每天到这个时间（本机时区），AI 自我升级一次：读你的笔记/进化/记忆 → 升级进化、沉淀记忆 → 产出当天的「启示」。也可在启示页随时手动生成。
                    </div>
                </div>

                <!-- 快捷指令 -->
                <div class="set-group">
                    <div class="set-title">快捷指令</div>
                    <div class="set-card">
                        <div class="set-row">
                            <input class="set-input" v-model="scDraft" :disabled="!ws.showActions" placeholder="新增一条快捷指令…" spellcheck="false" @keydown.enter="scAdd" />
                            <button class="set-act" :disabled="!ws.showActions || !scDraft.trim()" @click="scAdd">添加</button>
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
                    <div class="set-note">
                        聊天输入框「+」面板里的常用语，点一下填进输入框。可增删改、用 ↑↓ 调整顺序。
                    </div>
                </div>

                <div class="set-actions">
                    <button class="cta" :disabled="!ws.showActions || !dirty || saving" @click="save">{{ saved ? '已保存 ✓' : (saving ? '保存中…' : '保存') }}</button>
                    <button class="set-act" :disabled="!dirty || saving" @click="reset">重置</button>
                </div>

                <!-- 关于 -->
                <div class="set-group">
                    <div class="set-title">关于</div>
                    <div class="set-card">
                        <div class="set-row">
                            <span class="set-k">连接</span>
                            <span class="set-v">{{ ws.statusText }}</span>
                        </div>
                        <div class="set-row">
                            <span class="set-k">项目</span>
                            <span class="set-v">Roam · 漫游 —— 本机终端 / 文件 / 屏幕 / 对话</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.set-actions { display: flex; gap: 10px; align-items: center; margin: 14px 6px 0; }
</style>
