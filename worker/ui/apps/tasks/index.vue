<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/system/api';
import { useToastStore } from '@/system/stores/toast';
import ControlCenter from '@/system/components/ControlCenter.vue';

const router = useRouter();
const toast = useToastStore();
const tasks = ref([]);
const mode = ref('list');
const expanded = ref(null);
const detail = ref(null);

const form = ref(emptyForm());
function emptyForm() {
    return { id: null, name: '', prompt: '', kind: 'cron', cron: '0 22 * * *', runAtLocal: '', needs_device: false, enabled: true };
}

const CRON_PRESETS = [
    { label: '每天早 6 点', cron: '0 22 * * *' },
    { label: '每天晚 10 点', cron: '0 14 * * *' },
    { label: '每小时', cron: '0 * * * *' },
    { label: '每周一早 9 点', cron: '0 1 * * 1' },
];

async function load() {
    try { tasks.value = (await api.get('/apps/tasks')).tasks || []; } catch { /* toast */ }
}
onMounted(load);

function openNew() { form.value = emptyForm(); mode.value = 'edit'; }
function openEdit(t) {
    form.value = {
        id: t.id, name: t.name, prompt: t.prompt,
        kind: t.kind === 'once' ? 'once' : 'cron',
        cron: t.cron || '0 22 * * *',
        runAtLocal: t.run_at ? toLocalInput(t.run_at) : '',
        needs_device: !!t.needs_device, enabled: !!t.enabled,
    };
    mode.value = 'edit';
}

async function save() {
    const f = form.value;
    const body = {
        name: f.name.trim() || '未命名任务',
        prompt: f.prompt,
        kind: f.kind,
        needs_device: f.needs_device,
        enabled: f.enabled,
    };
    if (f.kind === 'once') body.run_at = f.runAtLocal ? new Date(f.runAtLocal).getTime() : null;
    else body.cron = f.cron.trim();
    try {
        if (f.id) await api.put(`/apps/tasks/${f.id}`, body);
        else await api.post('/apps/tasks', body);
        mode.value = 'list';
        await load();
    } catch { /* toast */ }
}

async function toggleEnabled(t) {
    try { await api.put(`/apps/tasks/${t.id}`, { enabled: !t.enabled }); await load(); } catch { /* toast */ }
}
async function runNow(t) {
    try { await api.post(`/apps/tasks/${t.id}/run`); toast.show('已触发', 2000); } catch { /* toast */ }
}
async function remove(t) {
    if (!confirm(`删除任务「${t.name || '未命名'}」？`)) return;
    try { await api.del(`/apps/tasks/${t.id}`); if (expanded.value === t.id) expanded.value = null; await load(); } catch { /* toast */ }
}
async function toggleRuns(t) {
    if (expanded.value === t.id) { expanded.value = null; return; }
    expanded.value = t.id;
    detail.value = null;
    try { detail.value = (await api.get(`/apps/tasks/${t.id}`)).task; } catch { /* toast */ }
}
function openRun(r) { if (r.chat_id) router.push(`/chat/${r.chat_id}`); }

const pad = (n) => String(n).padStart(2, '0');
function fmtTime(ts) {
    const t = Number(ts) || 0; if (!t) return '';
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toLocalInput(ts) {
    const d = new Date(Number(ts));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WD = ['日', '一', '二', '三', '四', '五', '六'];
function utcToLocalHM(h, m) { const d = new Date(); d.setUTCHours(h, m, 0, 0); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function cronText(cron) {
    const p = String(cron || '').trim().split(/\s+/);
    if (p.length !== 5) return cron || '—';
    const [mi, ho, , , dow] = p;
    if (/^\*\/\d+$/.test(mi) && ho === '*') return `每 ${mi.slice(2)} 分钟`;
    if (mi === '0' && ho === '*') return '每小时';
    if (/^\d+$/.test(mi) && /^\d+$/.test(ho)) {
        const hm = utcToLocalHM(+ho, +mi);
        if (dow === '*') return `每天 ${hm}`;
        if (/^[0-6]$/.test(dow)) return `每周${WD[+dow]} ${hm}`;
    }
    return cron;
}
function describe(t) {
    if (t.kind === 'once') return t.run_at ? `一次性 · ${fmtTime(t.run_at)}` : '一次性 · 尽快';
    return cronText(t.cron);
}

const STATUS = { done: '完成', error: '出错', skipped: '跳过', running: '运行中' };
const detailRuns = computed(() => detail.value?.runs || []);
</script>

<template>
    <section class="view">
        <div class="toolbar">
            <div class="toolbar-title">{{ mode === 'list' ? '任务' : (form.id ? '编辑任务' : '新建任务') }}</div>
            <button v-if="mode === 'list'" class="toolbar-btn primary" @click="openNew">+ 新建</button>
            <button v-else class="toolbar-btn" @click="mode = 'list'">取消</button>
            <ControlCenter />
        </div>

        <div class="page-wrap">
            <div class="tasks-inner">
                <!-- 列表 -->
                <template v-if="mode === 'list'">
                    <div v-if="!tasks.length" class="empty">
                        <div class="empty-icon">⏰</div>
                        <div class="empty-title">还没有任务</div>
                        <div class="empty-sub">让 AI 定时替你跑活 —— 比如每天早上生成日报</div>
                    </div>

                    <div v-for="t in tasks" :key="t.id" class="task-card" :class="{ open: expanded === t.id }">
                        <div class="task-row">
                            <button class="toggle-sw" :class="{ on: t.enabled }" @click.stop="toggleEnabled(t)">
                                <span class="toggle-knob"></span>
                            </button>

                            <button class="task-info" @click="toggleRuns(t)">
                                <div class="task-name" :class="{ off: !t.enabled }">{{ t.name || '未命名任务' }}</div>
                                <div class="task-meta">
                                    <span class="kind-tag" :class="t.kind">{{ t.kind === 'once' ? '一次性' : '循环' }}</span>
                                    <span class="sched-text">{{ describe(t) }}</span>
                                    <span v-if="t.needs_device" class="meta-chip">需设备</span>
                                    <span v-if="t.last_status" class="meta-chip" :class="t.last_status">{{ STATUS[t.last_status] || t.last_status }}</span>
                                </div>
                            </button>

                            <div class="task-ops">
                                <button class="op-btn" @click.stop="runNow(t)" title="立即运行">▶</button>
                                <button class="op-btn" @click.stop="openEdit(t)" title="编辑">✎</button>
                                <button class="op-btn danger" @click.stop="remove(t)" title="删除">✕</button>
                            </div>
                        </div>

                        <div v-if="expanded === t.id" class="runs-panel">
                            <div v-if="!detail" class="runs-tip">加载中…</div>
                            <template v-else>
                                <div v-if="!detailRuns.length" class="runs-tip">还没有运行记录</div>
                                <button v-for="r in detailRuns" :key="r.id" class="run-item" :class="{ link: r.chat_id }"
                                    :disabled="!r.chat_id" @click="openRun(r)">
                                    <span class="run-dot" :class="r.status"></span>
                                    <span class="run-time">{{ fmtTime(r.started_at) }}</span>
                                    <span class="run-summary">{{ r.summary || STATUS[r.status] }}</span>
                                    <span v-if="r.chat_id" class="run-go">查看 ›</span>
                                </button>
                            </template>
                        </div>
                    </div>
                </template>

                <!-- 编辑表单 -->
                <template v-else>
                    <div class="form-group">
                        <label class="form-label">名称</label>
                        <input class="form-input" v-model="form.name" placeholder="比如：每日早报" />
                    </div>

                    <div class="form-group">
                        <label class="form-label">指令 <em>给 AI 的 prompt</em></label>
                        <textarea class="form-input form-textarea" v-model="form.prompt" rows="4"
                            placeholder="比如：读取最近的笔记，整理成一份今日早报。"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">类型</label>
                        <div class="seg-group">
                            <button class="seg-btn" :class="{ on: form.kind === 'cron' }" @click="form.kind = 'cron'">循环</button>
                            <button class="seg-btn" :class="{ on: form.kind === 'once' }" @click="form.kind = 'once'">一次性</button>
                        </div>
                    </div>

                    <template v-if="form.kind === 'cron'">
                        <div class="form-group">
                            <label class="form-label">定时 <em>cron（UTC）</em></label>
                            <input class="form-input mono" v-model="form.cron" placeholder="0 22 * * *" />
                        </div>
                        <div class="preset-row">
                            <button v-for="p in CRON_PRESETS" :key="p.cron" class="preset-chip"
                                :class="{ on: form.cron.trim() === p.cron }" @click="form.cron = p.cron">{{ p.label }}</button>
                        </div>
                        <div class="form-hint">{{ cronText(form.cron) }}</div>
                    </template>
                    <template v-else>
                        <div class="form-group">
                            <label class="form-label">运行时间 <em>留空 = 尽快</em></label>
                            <input class="form-input" type="datetime-local" v-model="form.runAtLocal" />
                        </div>
                    </template>

                    <div class="toggle-row">
                        <span>需要设备在线 <em>离线则跳过</em></span>
                        <button class="toggle-sw" :class="{ on: form.needs_device }" @click="form.needs_device = !form.needs_device"><span class="toggle-knob"></span></button>
                    </div>
                    <div class="toggle-row">
                        <span>启用</span>
                        <button class="toggle-sw" :class="{ on: form.enabled }" @click="form.enabled = !form.enabled"><span class="toggle-knob"></span></button>
                    </div>

                    <button class="save-btn" @click="save">保存任务</button>
                </template>
            </div>
        </div>
    </section>
</template>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; min-height: 0; }

.toolbar { flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--bg); }
.toolbar-title { flex: 1; font-size: 15px; font-weight: 850; color: var(--ink); }
.toolbar-btn { padding: 7px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; background: var(--panel); color: var(--muted); border: 1px solid var(--line); }
.toolbar-btn:hover { color: var(--ink); border-color: var(--line2); }
.toolbar-btn.primary { background: var(--accent); color: #fff; border: none; }
.toolbar-btn.primary:hover { filter: brightness(1.06); }

.page-wrap { flex: 1; overflow-y: auto; padding: 16px; }
.tasks-inner { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }

.empty { text-align: center; padding: 56px 20px; }
.empty-icon { font-size: 36px; opacity: .6; margin-bottom: 8px; }
.empty-title { font-size: 15px; font-weight: 800; color: var(--ink); margin-bottom: 4px; }
.empty-sub { font-size: 13px; color: var(--muted); line-height: 1.7; }

/* 任务卡 */
.task-card { background: var(--panel); border-radius: 18px; box-shadow: 0 4px 16px #0000000a; overflow: hidden; border: 1px solid var(--line); transition: border-color .14s, box-shadow .14s; }
.task-card:hover { border-color: var(--line2); }
.task-card.open { border-color: color-mix(in srgb, var(--accent) 40%, transparent); box-shadow: 0 6px 24px #0000000f; }

.task-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.task-info { flex: 1; min-width: 0; text-align: left; cursor: pointer; }
.task-name { font-size: 14px; font-weight: 750; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-name.off { color: var(--muted); }
.task-meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
.kind-tag { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 99px; }
.kind-tag.cron { background: var(--accent-soft); color: var(--accent-d); }
.kind-tag.once { background: var(--well); color: var(--muted); }
.sched-text { font-size: 12px; color: var(--muted); }
.meta-chip { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; background: var(--well); color: var(--muted); }
.meta-chip.done { background: var(--win-soft); color: var(--win); }
.meta-chip.error { background: var(--bad-soft); color: var(--bad); }
.meta-chip.running { background: var(--accent-soft); color: var(--accent-d); }

.task-ops { display: flex; gap: 4px; flex-shrink: 0; }
.op-btn { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; font-size: 13px; color: var(--muted); transition: background .12s, color .12s; }
.op-btn:hover { background: var(--well); color: var(--ink); }
.op-btn.danger:hover { background: var(--bad-soft); color: var(--bad); }

/* 开关 */
.toggle-sw { width: 40px; height: 23px; border-radius: 99px; background: var(--well); position: relative; flex-shrink: 0; transition: background .16s; border: 1px solid var(--line); }
.toggle-sw.on { background: var(--win); border-color: var(--win); }
.toggle-knob { position: absolute; top: 1.5px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .16s; box-shadow: 0 1px 3px #0003; }
.toggle-sw.on .toggle-knob { left: 18px; }

/* 运行记录 */
.runs-panel { border-top: 1px solid var(--line); padding: 8px; background: color-mix(in srgb, var(--bg) 50%, transparent); }
.runs-tip { color: var(--muted); font-size: 12px; padding: 10px 8px; }
.run-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 10px; text-align: left; font-size: 12px; transition: background .12s; }
.run-item.link { cursor: pointer; }
.run-item.link:hover { background: var(--well); }
.run-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--muted); }
.run-dot.done { background: var(--win); }
.run-dot.error { background: var(--bad); }
.run-dot.running { background: var(--accent); }
.run-time { flex-shrink: 0; color: var(--muted); font-variant-numeric: tabular-nums; }
.run-summary { flex: 1; min-width: 0; color: var(--ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.run-go { flex-shrink: 0; color: var(--accent); font-weight: 700; font-size: 11px; }

/* 表单 */
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 12.5px; font-weight: 750; color: var(--ink); }
.form-label em { font-style: normal; font-weight: 500; color: var(--muted); margin-left: 6px; }
.form-input {
    border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px;
    background: var(--panel); color: var(--ink); font-size: 14px; outline: none; width: 100%;
    transition: border-color .12s;
}
.form-input:focus { border-color: var(--accent); }
.form-textarea { resize: vertical; line-height: 1.6; min-height: 96px; font-size: 13px; }
.mono { font-family: var(--mono); font-size: 13px; letter-spacing: .02em; }

.seg-group { display: inline-flex; padding: 3px; gap: 3px; background: var(--well); border-radius: 12px; border: 1px solid var(--line); }
.seg-btn { padding: 7px 20px; border-radius: 9px; font-size: 13px; font-weight: 700; color: var(--muted); transition: .14s; }
.seg-btn.on { background: var(--panel); color: var(--ink); box-shadow: 0 1px 4px #0000001a; }

.preset-row { display: flex; flex-wrap: wrap; gap: 7px; }
.preset-chip { padding: 6px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel); color: var(--muted); font-size: 12px; font-weight: 650; transition: .12s; }
.preset-chip:hover { border-color: var(--line2); color: var(--ink); }
.preset-chip.on { border-color: var(--accent); color: var(--accent-d); background: var(--accent-soft); }
.form-hint { font-size: 12px; color: var(--muted); padding: 2px 0; }

.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
.toggle-row > span { font-size: 13px; font-weight: 700; color: var(--ink); }
.toggle-row em { font-style: normal; font-weight: 500; color: var(--muted); margin-left: 6px; font-size: 12px; }

.save-btn {
    width: 100%; padding: 13px; border-radius: 14px; font-size: 14px; font-weight: 800; color: #fff;
    background: linear-gradient(135deg, var(--accent), var(--accent-d));
    box-shadow: 0 6px 16px #00000030, inset 0 2px 0 #ffffff55; transition: transform .12s;
}
.save-btn:hover { transform: translateY(-2px); }
.save-btn:active { transform: scale(.97); }
</style>
