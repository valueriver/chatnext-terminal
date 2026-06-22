<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/system/api';
import { useToastStore } from '@/system/stores/toast';
import ControlCenter from '@/system/components/ControlCenter.vue';

const router = useRouter();
const toast = useToastStore();
const tasks = ref([]);
const mode = ref('list');     // list | edit
const expanded = ref(null);   // 展开查看运行历史的 task id
const detail = ref(null);     // { ...task, runs }

const form = ref(emptyForm());
function emptyForm() {
    return { id: null, name: '', prompt: '', kind: 'cron', cron: '0 22 * * *', runAtLocal: '', needs_device: false, enabled: true };
}

const CRON_PRESETS = [
    { label: '每天早上 6 点', cron: '0 22 * * *' },   // UTC 22:00 = 北京 06:00
    { label: '每天晚上 10 点', cron: '0 14 * * *' },  // UTC 14:00 = 北京 22:00
    { label: '每小时', cron: '0 * * * *' },
    { label: '每 5 分钟', cron: '*/5 * * * *' },
    { label: '每周一早 9 点', cron: '0 1 * * 1' },
];

async function load() {
    try { tasks.value = (await api.get('/apps/tasks')).tasks || []; } catch { /* toast 已弹 */ }
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
    try { await api.post(`/apps/tasks/${t.id}/run`); toast.show('已触发,稍后看运行记录', 2200); } catch { /* toast */ }
}
async function remove(t) {
    if (!confirm(`删除任务「${t.name || '未命名任务'}」?`)) return;
    try { await api.del(`/apps/tasks/${t.id}`); if (expanded.value === t.id) expanded.value = null; await load(); } catch { /* toast */ }
}
async function toggleRuns(t) {
    if (expanded.value === t.id) { expanded.value = null; return; }
    expanded.value = t.id;
    detail.value = null;
    try { detail.value = (await api.get(`/apps/tasks/${t.id}`)).task; } catch { /* toast */ }
}
function openRun(r) { if (r.chat_id) router.push(`/chat/${r.chat_id}`); }

// ── 时间格式 ──
const pad = (n) => String(n).padStart(2, '0');
function fmtTime(ts) {
    const t = Number(ts) || 0; if (!t) return '';
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toLocalInput(ts) { // epoch ms → 'YYYY-MM-DDTHH:mm'(本地)给 datetime-local
    const d = new Date(Number(ts));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── 调度的人话描述 ──
const WD = ['日', '一', '二', '三', '四', '五', '六'];
function utcToLocalHM(h, m) { const d = new Date(); d.setUTCHours(h, m, 0, 0); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function cronText(cron) {
    const p = String(cron || '').trim().split(/\s+/);
    if (p.length !== 5) return cron || '—';
    const [mi, ho, dom, mo, dow] = p;
    if (/^\*\/\d+$/.test(mi) && ho === '*' && dom === '*' && mo === '*' && dow === '*') return `每 ${mi.slice(2)} 分钟`;
    if (mi === '0' && ho === '*' && dom === '*' && mo === '*' && dow === '*') return '每小时';
    if (/^\d+$/.test(mi) && /^\d+$/.test(ho) && dom === '*' && mo === '*') {
        const hm = utcToLocalHM(+ho, +mi);
        if (dow === '*') return `每天 ${hm}`;
        if (/^[0-6]$/.test(dow)) return `每周${WD[+dow]} ${hm}`;
    }
    return cron;
}
function describe(t) {
    if (t.kind === 'once') return t.run_at ? `一次性 · ${fmtTime(t.run_at)}` : '一次性 · 尽快运行';
    return cronText(t.cron);
}

const STATUS = { done: '完成', error: '出错', skipped: '跳过', running: '运行中' };
const ICON = { done: '✓', error: '✕', skipped: '↷', running: '…' };
const detailRuns = computed(() => detail.value?.runs || []);
</script>

<template>
    <section class="view">
        <div class="head">
            <div class="head-title">⏰ 任务</div>
            <button v-if="mode === 'list'" class="btn-primary" @click="openNew">+ 新建</button>
            <button v-else class="btn-ghost" @click="mode = 'list'">取消</button>
            <ControlCenter />
        </div>

        <div class="page-wrap">
            <!-- ════ 列表 ════ -->
            <div v-if="mode === 'list'" class="wrap">
                <div v-if="!tasks.length" class="empty">
                    <div class="empty-emoji">⏰</div>
                    <div class="empty-title">还没有任务</div>
                    <div class="empty-sub">点右上「新建」让 AI 定时或一次性地替你跑活 —— 比如每天早上读笔记生成早报。</div>
                </div>

                <div v-for="t in tasks" :key="t.id" class="card" :class="{ open: expanded === t.id }">
                    <div class="row">
                        <button class="sw" :class="{ on: t.enabled }" @click="toggleEnabled(t)"
                            :title="t.enabled ? '已启用,点击停用' : '已停用,点击启用'"><span></span></button>

                        <button class="info" @click="toggleRuns(t)">
                            <div class="name" :class="{ off: !t.enabled }">{{ t.name || '未命名任务' }}</div>
                            <div class="meta">
                                <span class="sched">
                                    <span class="kind" :class="t.kind === 'once' ? 'once' : 'cron'">{{ t.kind === 'once' ? '一次性' : '循环' }}</span>
                                    {{ describe(t) }}
                                </span>
                                <span v-if="t.needs_device" class="chip">需设备</span>
                                <span v-if="t.last_status" class="chip" :class="t.last_status">
                                    {{ ICON[t.last_status] }} {{ STATUS[t.last_status] || t.last_status }}
                                </span>
                            </div>
                        </button>

                        <div class="ops">
                            <button class="op" @click="runNow(t)" title="立即运行">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            </button>
                            <button class="op" @click="openEdit(t)" title="编辑">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            </button>
                            <button class="op danger" @click="remove(t)" title="删除">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- 运行记录 -->
                    <div v-if="expanded === t.id" class="runs">
                        <div v-if="!detail" class="runs-tip">加载中…</div>
                        <template v-else>
                            <div v-if="!detailRuns.length" class="runs-tip">还没有运行记录。点 ▶ 立即跑一次。</div>
                            <button v-for="r in detailRuns" :key="r.id" class="run" :class="{ link: r.chat_id }"
                                :disabled="!r.chat_id" @click="openRun(r)"
                                :title="r.chat_id ? '点击查看本次 agent 对话' : ''">
                                <span class="run-st" :class="r.status">{{ ICON[r.status] }}</span>
                                <span class="run-time">{{ fmtTime(r.started_at) }}</span>
                                <span class="run-sum">{{ r.summary || STATUS[r.status] }}</span>
                                <span v-if="r.chat_id" class="run-go">查看对话 ›</span>
                            </button>
                        </template>
                    </div>
                </div>
            </div>

            <!-- ════ 编辑 ════ -->
            <div v-else class="wrap">
                <label class="fld">
                    <span class="fld-k">名称</span>
                    <input class="in" v-model="form.name" placeholder="比如:每日早报" />
                </label>

                <label class="fld">
                    <span class="fld-k">指令 <em>给 AI 的 prompt</em></span>
                    <textarea class="in ta" v-model="form.prompt" rows="5"
                        placeholder="比如:读取我最近的笔记,整理成一份今日早报,写进一条新笔记。"></textarea>
                </label>

                <div class="fld">
                    <span class="fld-k">类型</span>
                    <div class="seg">
                        <button class="seg-b" :class="{ on: form.kind === 'cron' }" @click="form.kind = 'cron'">循环</button>
                        <button class="seg-b" :class="{ on: form.kind === 'once' }" @click="form.kind = 'once'">一次性</button>
                    </div>
                </div>

                <!-- 循环:cron -->
                <template v-if="form.kind === 'cron'">
                    <label class="fld">
                        <span class="fld-k">定时 <em>cron · UTC 时区</em></span>
                        <input class="in mono" v-model="form.cron" placeholder="0 22 * * *" />
                    </label>
                    <div class="presets">
                        <button v-for="p in CRON_PRESETS" :key="p.cron" class="preset"
                            :class="{ on: form.cron.trim() === p.cron }" @click="form.cron = p.cron">{{ p.label }}</button>
                    </div>
                    <div class="hint">当前规则：{{ cronText(form.cron) }}</div>
                </template>

                <!-- 一次性:datetime -->
                <template v-else>
                    <label class="fld">
                        <span class="fld-k">运行时间 <em>留空＝尽快运行</em></span>
                        <input class="in" type="datetime-local" v-model="form.runAtLocal" />
                    </label>
                    <div class="hint">{{ form.runAtLocal ? `将在 ${fmtTime(new Date(form.runAtLocal).getTime())} 运行一次` : '保存后将在下一分钟内运行一次' }}</div>
                </template>

                <label class="toggle">
                    <span>需要设备在线 <em>离线则跳过本次</em></span>
                    <button class="sw" :class="{ on: form.needs_device }" type="button" @click="form.needs_device = !form.needs_device"><span></span></button>
                </label>
                <label class="toggle">
                    <span>启用</span>
                    <button class="sw" :class="{ on: form.enabled }" type="button" @click="form.enabled = !form.enabled"><span></span></button>
                </label>

                <button class="btn-primary save" @click="save">保存任务</button>
            </div>
        </div>
    </section>
</template>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.head { flex-shrink: 0; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--color-line); background: var(--color-bg); padding: 10px 12px; }
.head-title { flex: 1; min-width: 0; font-size: 15px; font-weight: 850; color: var(--color-ink); }
.page-wrap { flex: 1; min-height: 0; overflow-y: auto; }
.wrap { padding: 16px; max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }

.btn-primary { padding: 7px 14px; border-radius: 10px; background: var(--color-accent); color: #fff; font-size: 13px; font-weight: 750; transition: filter .12s, transform .12s; }
.btn-primary:hover { filter: brightness(1.06); }
.btn-primary:active { transform: scale(.97); }
.btn-ghost { padding: 7px 14px; border-radius: 10px; background: var(--color-bg-elev); color: var(--color-muted); border: 1px solid var(--color-line); font-size: 13px; font-weight: 700; }
.btn-ghost:hover { color: var(--color-ink); border-color: var(--color-line-hi); }

/* 空状态 */
.empty { text-align: center; padding: 56px 20px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.empty-emoji { font-size: 38px; opacity: .8; }
.empty-title { font-size: 16px; font-weight: 800; color: var(--color-ink); }
.empty-sub { font-size: 13px; color: var(--color-muted); line-height: 1.7; max-width: 340px; }

/* 任务卡 */
.card { border: 1px solid var(--color-line); border-radius: 16px; background: var(--color-bg-elev); overflow: hidden; transition: border-color .14s, box-shadow .14s; }
.card:hover { border-color: var(--color-line-hi); }
.card.open { border-color: color-mix(in srgb, var(--color-accent) 40%, transparent); box-shadow: 0 6px 20px #0000000f; }
.row { display: flex; align-items: center; gap: 12px; padding: 13px 14px; }
.info { flex: 1; min-width: 0; text-align: left; }
.name { font-size: 14.5px; font-weight: 750; color: var(--color-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name.off { color: var(--color-faint); }
.meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
.sched { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-muted); }
.kind { font-size: 10px; font-weight: 800; letter-spacing: .03em; padding: 1.5px 7px; border-radius: 999px; }
.kind.cron { background: var(--accent-soft); color: var(--color-accent-hi); }
.kind.once { background: var(--well); color: var(--color-muted); }
.chip { font-size: 10.5px; font-weight: 700; padding: 1.5px 8px; border-radius: 999px; background: var(--well); color: var(--color-muted); }
.chip.done { background: var(--win-soft); color: var(--win); }
.chip.error { background: color-mix(in srgb, var(--color-bad) 16%, transparent); color: var(--color-bad); }
.chip.running { background: var(--accent-soft); color: var(--color-accent-hi); }

.ops { display: flex; gap: 2px; flex-shrink: 0; }
.op { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; color: var(--color-faint); transition: background .12s, color .12s; }
.op:hover { background: var(--well); color: var(--color-ink); }
.op.danger:hover { background: color-mix(in srgb, var(--color-bad) 12%, transparent); color: var(--color-bad); }

/* 开关 */
.sw { width: 40px; height: 23px; border-radius: 999px; background: var(--well); position: relative; flex-shrink: 0; transition: background .16s; }
.sw.on { background: var(--win); }
.sw span { position: absolute; top: 2px; left: 2px; width: 19px; height: 19px; border-radius: 999px; background: #fff; transition: left .16s; box-shadow: 0 1px 3px #0003; }
.sw.on span { left: 18px; }

/* 运行记录 */
.runs { border-top: 1px solid var(--color-line); padding: 6px; display: flex; flex-direction: column; gap: 2px; background: color-mix(in srgb, var(--color-bg) 40%, transparent); }
.runs-tip { color: var(--color-faint); font-size: 12px; padding: 10px 10px; }
.run { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 10px; text-align: left; font-size: 12.5px; transition: background .12s; }
.run.link { cursor: pointer; }
.run.link:hover { background: var(--color-bg-hi); }
.run:disabled { cursor: default; }
.run-st { flex-shrink: 0; width: 18px; text-align: center; font-weight: 800; }
.run-st.done { color: var(--win); } .run-st.error { color: var(--color-bad); }
.run-st.skipped { color: var(--color-faint); } .run-st.running { color: var(--color-accent); }
.run-time { flex-shrink: 0; color: var(--color-faint); font-variant-numeric: tabular-nums; }
.run-sum { flex: 1; min-width: 0; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.run-go { flex-shrink: 0; color: var(--color-accent); font-weight: 700; font-size: 11.5px; }

/* 表单 */
.fld { display: flex; flex-direction: column; gap: 7px; }
.fld-k { font-size: 12.5px; font-weight: 750; color: var(--color-ink); }
.fld-k em { font-style: normal; font-weight: 500; color: var(--color-faint); margin-left: 6px; }
.in { border: 1px solid var(--color-line); border-radius: 11px; padding: 10px 12px; background: var(--color-bg-elev); color: var(--color-ink); font-size: 14px; transition: border-color .12s; width: 100%; }
.in:focus { outline: none; border-color: var(--color-accent); }
.ta { resize: vertical; line-height: 1.6; min-height: 96px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em; }

.seg { display: inline-flex; padding: 3px; gap: 3px; background: var(--well); border-radius: 12px; border: 1px solid var(--color-line); width: fit-content; }
.seg-b { padding: 7px 22px; border-radius: 9px; font-size: 13px; font-weight: 700; color: var(--color-muted); transition: background .14s, color .14s; }
.seg-b.on { background: var(--color-bg-elev); color: var(--color-ink); box-shadow: 0 1px 3px #0000001a; }

.presets { display: flex; flex-wrap: wrap; gap: 7px; }
.preset { padding: 6px 12px; border-radius: 9px; border: 1px solid var(--color-line); background: var(--color-bg-elev); color: var(--color-muted); font-size: 12.5px; font-weight: 650; transition: .12s; }
.preset:hover { border-color: var(--color-line-hi); color: var(--color-ink); }
.preset.on { border-color: var(--color-accent); color: var(--color-accent-hi); background: var(--accent-soft); }
.hint { font-size: 12px; color: var(--color-muted); padding: 2px 2px; }

.toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid var(--color-line); border-radius: 13px; background: var(--color-bg-elev); }
.toggle > span { font-size: 13.5px; font-weight: 700; color: var(--color-ink); }
.toggle em { font-style: normal; font-weight: 500; color: var(--color-faint); margin-left: 6px; font-size: 12px; }
.save { margin-top: 4px; height: 46px; border-radius: 13px; font-size: 14.5px; }
</style>
