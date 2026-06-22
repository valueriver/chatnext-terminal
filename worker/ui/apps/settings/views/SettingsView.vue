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
            <div class="s-wrap">
                <!-- 外观 -->
                <section class="grp">
                    <div class="lbl">外观</div>
                    <div class="card">
                        <div class="row">
                            <span class="k">主题</span>
                            <div class="seg">
                                <button class="seg-b" :class="{ on: theme.theme === 'sky' }" @click="theme.setTheme('sky')">🌤 晴空</button>
                                <button class="seg-b" :class="{ on: theme.theme === 'night' }" @click="theme.setTheme('night')">🌙 谧夜</button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 模型 -->
                <section class="grp">
                    <div class="lbl">模型</div>
                    <div class="card">
                        <label class="row col">
                            <span class="k">API 地址</span>
                            <input class="in" v-model="form.apiUrl" :disabled="!ws.connected" placeholder="https://api.openai.com/v1" spellcheck="false" autocapitalize="off" />
                        </label>
                        <label class="row col">
                            <span class="k">API Key</span>
                            <input class="in" v-model="form.apiKey" type="password" :disabled="!ws.connected" :placeholder="keyMasked" autocomplete="off" spellcheck="false" />
                        </label>
                        <label class="row col">
                            <span class="k">模型名</span>
                            <input class="in" v-model="form.model" :disabled="!ws.connected" placeholder="gpt-4o" spellcheck="false" autocapitalize="off" />
                        </label>
                    </div>
                    <p class="note">配置存在云端，AI 对话用它调用 OpenAI 兼容接口。Key 留空＝不改。</p>
                </section>

                <!-- 对话压缩 -->
                <section class="grp">
                    <div class="lbl">对话压缩</div>
                    <div class="card">
                        <label class="row col">
                            <span class="k">压缩阈值 <em>tokens</em></span>
                            <input class="in" v-model="form.compressThreshold" type="number" inputmode="numeric" :disabled="!ws.connected" placeholder="12000" />
                        </label>
                        <label class="row col">
                            <span class="k">工具结果上限 <em>字符</em></span>
                            <input class="in" v-model="form.toolResultMaxChars" type="number" inputmode="numeric" :disabled="!ws.connected" placeholder="12000" />
                        </label>
                        <label class="row col">
                            <span class="k">压缩提示词 <em>留空用内置默认</em></span>
                            <textarea class="in ta" v-model="form.compactPrompt" :disabled="!ws.connected" rows="4" placeholder="自定义压缩时给模型的指令…" spellcheck="false"></textarea>
                        </label>
                    </div>
                    <p class="note">上下文超阈值时自动把较早消息摘要成一条；工具结果超上限会截断。</p>
                </section>

                <!-- 模型 / 压缩 的保存 -->
                <div class="save-bar">
                    <button class="btn-primary" :disabled="!ws.connected || !dirty || saving" @click="save">{{ saved ? '已保存 ✓' : (saving ? '保存中…' : '保存更改') }}</button>
                    <button class="btn-ghost" :disabled="!dirty || saving" @click="reset">重置</button>
                </div>

                <!-- 快捷指令 -->
                <section class="grp">
                    <div class="lbl">快捷指令</div>
                    <div class="add">
                        <input class="in" v-model="scDraft" :disabled="!ws.connected" placeholder="新增一条快捷指令…" spellcheck="false" @keydown.enter="scAdd" />
                        <button class="btn-add" :disabled="!ws.connected || !scDraft.trim()" @click="scAdd">添加</button>
                    </div>
                    <div v-if="shortcuts.items.length" class="card sc-list">
                        <div v-for="(s, i) in shortcuts.items" :key="s.id" class="sc-row">
                            <template v-if="scEditId === s.id">
                                <input class="in" v-model="scEditText" spellcheck="false" @keydown.enter="scCommitEdit" />
                                <button class="btn-add" @click="scCommitEdit">保存</button>
                            </template>
                            <template v-else>
                                <span class="sc-txt">{{ s.text }}</span>
                                <div class="sc-ops">
                                    <button class="op" :disabled="i === 0" title="上移" @click="scMove(i, -1)">↑</button>
                                    <button class="op" :disabled="i === shortcuts.items.length - 1" title="下移" @click="scMove(i, 1)">↓</button>
                                    <button class="op" title="编辑" @click="scStartEdit(s)">改</button>
                                    <button class="op danger" title="删除" @click="scDel(s)">删</button>
                                </div>
                            </template>
                        </div>
                    </div>
                    <p class="note">聊天输入框「+」面板里的常用语，点一下填进输入框。改动即时生效。</p>
                </section>

                <!-- 退出 -->
                <button class="logout" @click="logout">退出登录</button>

                <div class="foot">One · {{ ws.statusText }}</div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.s-wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 40px; display: flex; flex-direction: column; gap: 24px; }
.grp { display: flex; flex-direction: column; gap: 9px; }
.lbl { font-size: 11.5px; font-weight: 800; letter-spacing: .08em; color: var(--color-faint); text-transform: uppercase; padding: 0 4px; }

.card { border: 1px solid var(--color-line); border-radius: 16px; background: var(--color-bg-elev); overflow: hidden; }
.row { display: flex; align-items: center; gap: 12px; padding: 13px 15px; border-bottom: 1px solid var(--color-line); }
.row:last-child { border-bottom: 0; }
.row.col { flex-direction: column; align-items: stretch; gap: 8px; }
.k { font-size: 13px; font-weight: 700; color: var(--color-ink); flex-shrink: 0; }
.k em { font-style: normal; font-weight: 500; color: var(--color-faint); font-size: 11.5px; margin-left: 6px; }

.in { width: 100%; min-width: 0; border: 1px solid var(--color-line); border-radius: 10px; background: var(--color-bg); padding: 10px 12px; font-size: 15px; color: var(--color-ink); outline: none; transition: border-color .12s; }
.in:focus { border-color: var(--color-accent); }
.in:disabled { opacity: .55; }
.ta { resize: vertical; min-height: 84px; line-height: 1.6; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.seg { display: inline-flex; gap: 3px; padding: 3px; border-radius: 11px; background: var(--well); border: 1px solid var(--color-line); }
.seg-b { padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 750; color: var(--color-muted); transition: .14s; }
.seg-b.on { background: var(--color-bg-elev); color: var(--color-ink); box-shadow: 0 1px 3px #0000001f; }

.save-bar { display: flex; gap: 10px; align-items: center; }
.btn-primary { padding: 10px 20px; border-radius: 11px; background: var(--color-accent); color: #fff; font-size: 14px; font-weight: 750; transition: filter .12s, transform .12s; }
.btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.btn-primary:active:not(:disabled) { transform: scale(.97); }
.btn-primary:disabled { opacity: .45; }
.btn-ghost { padding: 10px 16px; border-radius: 11px; background: var(--color-bg-elev); border: 1px solid var(--color-line); color: var(--color-muted); font-size: 13px; font-weight: 700; }
.btn-ghost:hover:not(:disabled) { color: var(--color-ink); border-color: var(--color-line-hi); }
.btn-ghost:disabled { opacity: .45; }

.add { display: flex; gap: 8px; align-items: center; }
.btn-add { flex-shrink: 0; padding: 10px 16px; border-radius: 10px; background: var(--accent-soft); color: var(--color-accent-hi); font-size: 13px; font-weight: 750; transition: .12s; }
.btn-add:hover:not(:disabled) { filter: brightness(.97); }
.btn-add:disabled { opacity: .4; }
.sc-list { margin-top: 2px; }
.sc-row { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--color-line); }
.sc-row:last-child { border-bottom: 0; }
.sc-txt { flex: 1; min-width: 0; font-size: 13.5px; color: var(--color-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-ops { display: flex; gap: 1px; flex-shrink: 0; }
.op { width: 28px; height: 28px; border-radius: 7px; color: var(--color-faint); font-size: 13px; font-weight: 700; transition: .12s; }
.op:hover:not(:disabled) { background: var(--well); color: var(--color-ink); }
.op.danger:hover { background: color-mix(in srgb, var(--color-bad, #d4564e) 12%, transparent); color: var(--color-bad, #d4564e); }
.op:disabled { opacity: .3; }

.logout { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--color-bad, #d4564e) 35%, var(--color-line)); background: transparent; color: var(--color-bad, #d4564e); font-size: 13.5px; font-weight: 750; transition: background .12s; }
.logout:hover { background: color-mix(in srgb, var(--color-bad, #d4564e) 9%, transparent); }
.foot { text-align: center; font-size: 11.5px; color: var(--color-faint); }
</style>
