<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useThemeStore } from '@/system/stores/theme';
import { useModelStore } from '@/apps/settings/store';
import { useWsStore } from '@/system/stores/ws';
import SettingsHeader from '../components/SettingsHeader.vue';

const theme = useThemeStore();
const model = useModelStore();
const ws = useWsStore();

const form = reactive({ baseUrl: '', apiKey: '', model: '' });
const saved = ref(false);
const saving = ref(false);

// 服务器只回掩码，不回明文 key
const keyMasked = computed(() => model.config.keyPreview || (model.config.hasKey ? '已设置' : '未设置'));

const dirty = computed(() =>
    form.baseUrl !== (model.config.baseUrl || '') ||
    form.model !== (model.config.model || '') ||
    form.apiKey.trim().length > 0
);

function syncFromServer() {
    const c = model.config;
    form.baseUrl = c.baseUrl || '';
    form.model = c.model || '';
    form.apiKey = ''; // 不回填明文，留空＝不改
}

async function load() {
    if (!ws.showActions) return;
    await model.load();
    syncFromServer();
}
async function save() {
    if (!ws.showActions || saving.value || !dirty.value) return;
    saving.value = true;
    const patch = {
        baseUrl: String(form.baseUrl).trim(),
        model: String(form.model).trim(),
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
                        <template v-if="ws.showActions">配置保存在本机 Server（~/.roam/model.json），AI 对话直接用它调用 OpenAI 兼容接口。当前 Key：{{ keyMasked }}。Key 留空＝不修改。</template>
                        <template v-else>未连接本机 Server，无法读写模型配置。请先在守卫页完成连接/认证。</template>
                    </div>
                    <div class="set-actions">
                        <button class="cta" :disabled="!ws.showActions || !dirty || saving" @click="save">{{ saved ? '已保存 ✓' : (saving ? '保存中…' : '保存') }}</button>
                        <button class="set-act" :disabled="!dirty || saving" @click="reset">重置</button>
                    </div>
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
