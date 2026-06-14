import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';

// 常见 OpenAI 兼容服务商预设（选中后自动填 API 地址与示例模型）
export const PROVIDER_PRESETS = [
    { id: 'deepseek',   name: 'DeepSeek',             baseUrl: 'https://api.deepseek.com/v1',                      model: 'deepseek-chat' },
    { id: 'openai',     name: 'OpenAI',               baseUrl: 'https://api.openai.com/v1',                        model: 'gpt-4o' },
    { id: 'moonshot',   name: 'Kimi · Moonshot',      baseUrl: 'https://api.moonshot.cn/v1',                       model: 'moonshot-v1-8k' },
    { id: 'dashscope',  name: '通义千问 · DashScope',  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    { id: 'zhipu',      name: '智谱 · GLM',            baseUrl: 'https://open.bigmodel.cn/api/paas/v4',             model: 'glm-4-plus' },
    { id: 'openrouter', name: 'OpenRouter',           baseUrl: 'https://openrouter.ai/api/v1',                     model: 'openai/gpt-4o' },
    { id: 'custom',     name: '自定义',                baseUrl: '',                                                 model: '' },
];

// 模型配置以本机 server（~/.roam/model.json）为唯一真相，经 WS 的 model.get/set 读写。
// 返回的 config 是安全视图：不含明文 key，只有 hasKey + keyPreview。
export const useModelStore = defineStore('model', () => {
    const ws = useWsStore();
    const config = ref({ baseUrl: '', model: '', temperature: 0.7, system: '', contextTurns: 100, hasKey: false, keyPreview: '' });
    const loaded = ref(false);

    const pending = new Map();
    let seq = 0;
    let bound = false;

    function request(type, data = {}) {
        return new Promise((resolve) => {
            const reqId = `m${Date.now()}_${seq++}`;
            pending.set(reqId, resolve);
            const ok = ws.sendMsg({ type, to: 'desktop', data: { ...data, reqId } });
            if (!ok) { pending.delete(reqId); resolve(null); return; }
            setTimeout(() => { if (pending.has(reqId)) { pending.delete(reqId); resolve(null); } }, 15000);
        });
    }
    function onResult(msg) {
        const d = msg.data || {};
        const r = d.reqId && pending.get(d.reqId);
        if (r) { pending.delete(d.reqId); r(d); }
    }
    function bind() {
        if (bound) return;
        bound = true;
        ws.onMessage('model.get.result', onResult);
        ws.onMessage('model.set.result', onResult);
    }

    async function load() {
        bind();
        const d = await request('model.get');
        if (d?.config) { config.value = d.config; loaded.value = true; }
        return config.value;
    }
    async function save(patch) {
        bind();
        const d = await request('model.set', { config: patch });
        if (d?.config) { config.value = d.config; loaded.value = true; }
        return config.value;
    }

    return { config, loaded, presets: PROVIDER_PRESETS, load, save };
});
