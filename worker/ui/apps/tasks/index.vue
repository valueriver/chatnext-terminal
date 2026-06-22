<script setup>
import { onMounted, ref } from 'vue';
import { api } from '@/system/api';
import { useToastStore } from '@/system/stores/toast';
import ControlCenter from '@/system/components/ControlCenter.vue';

const toast = useToastStore();
const tasks = ref([]);
const mode = ref('list');     // list | edit
const expanded = ref(null);   // 展开查看运行历史的 task id
const detail = ref(null);     // { task, runs }

const form = ref(emptyForm());
function emptyForm() {
    return { id: null, name: '', prompt: '', cron: '0 22 * * *', needs_device: false, enabled: true };
}

const PRESETS = [
    { label: '每天早上 6 点', cron: '0 22 * * *' },   // UTC 22:00 = 北京 06:00
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
    form.value = { id: t.id, name: t.name, prompt: t.prompt, cron: t.cron, needs_device: !!t.needs_device, enabled: !!t.enabled };
    mode.value = 'edit';
}

async function save() {
    const body = {
        name: form.value.name.trim() || '未命名任务',
        prompt: form.value.prompt,
        cron: form.value.cron.trim(),
        needs_device: form.value.needs_device,
        enabled: form.value.enabled,
    };
    try {
        if (form.value.id) await api.put(`/apps/tasks/${form.value.id}`, body);
        else await api.post('/apps/tasks', body);
        mode.value = 'list';
        await load();
    } catch { /* toast */ }
}

async function toggleEnabled(t) {
    try { await api.put(`/apps/tasks/${t.id}`, { enabled: !t.enabled }); await load(); } catch { /* toast */ }
}

async function runNow(t) {
    try { await api.post(`/apps/tasks/${t.id}/run`); toast.show('已触发,稍后看运行历史', 2200); } catch { /* toast */ }
}

async function remove(t) {
    if (!confirm(`删除任务「${t.name}」?`)) return;
    try { await api.del(`/apps/tasks/${t.id}`); if (expanded.value === t.id) expanded.value = null; await load(); } catch { /* toast */ }
}

async function toggleRuns(t) {
    if (expanded.value === t.id) { expanded.value = null; return; }
    expanded.value = t.id;
    detail.value = null;
    try { detail.value = await api.get(`/apps/tasks/${t.id}`); } catch { /* toast */ }
}

function fmtTime(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const STATUS = { done: '✓ 完成', error: '✕ 出错', skipped: '↷ 跳过', running: '… 运行中' };
</script>

<template>
    <section class="view">
        <div class="head">
            <div class="head-title">⏰ 任务</div>
            <button v-if="mode === 'list'" class="add" @click="openNew">+ 新建</button>
            <button v-else class="add ghost" @click="mode = 'list'">取消</button>
            <ControlCenter />
        </div>

        <div class="page-wrap">
            <!-- 列表 -->
            <div v-if="mode === 'list'" class="wrap">
                <div v-if="!tasks.length" class="empty">还没有定时任务。点右上「新建」创建一个 —— 比如每天早上让 AI 读笔记生成早报。</div>

                <div v-for="t in tasks" :key="t.id" class="task">
                    <div class="task-main">
                        <button class="sw" :class="{ on: t.enabled }" @click="toggleEnabled(t)" :title="t.enabled ? '已启用' : '已停用'"><span></span></button>
                        <button class="task-info" @click="toggleRuns(t)">
                            <div class="task-name">{{ t.name || '未命名任务' }}</div>
                            <div class="task-sub">
                                <code>{{ t.cron }}</code>
                                <span v-if="t.needs_device" class="tag">需设备</span>
                                <span v-if="t.last_status" class="tag" :class="t.last_status">{{ STATUS[t.last_status] || t.last_status }}</span>
                            </div>
                        </button>
                        <div class="task-ops">
                            <button class="op" @click="runNow(t)" title="立即运行">▶</button>
                            <button class="op" @click="openEdit(t)" title="编辑">✎</button>
                            <button class="op danger" @click="remove(t)" title="删除">🗑</button>
                        </div>
                    </div>

                    <!-- 运行历史 -->
                    <div v-if="expanded === t.id" class="runs">
                        <div v-if="!detail" class="runs-loading">加载中…</div>
                        <template v-else>
                            <div v-if="!detail.task?.runs?.length" class="runs-empty">还没有运行记录。</div>
                            <div v-for="r in detail.task?.runs || []" :key="r.id" class="run">
                                <span class="run-st" :class="r.status">{{ STATUS[r.status] || r.status }}</span>
                                <span class="run-time">{{ fmtTime(r.started_at) }}</span>
                                <span class="run-sum">{{ r.summary }}</span>
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <!-- 编辑 -->
            <div v-else class="wrap form">
                <label class="fld"><span>名称</span><input v-model="form.name" placeholder="比如:早报" /></label>
                <label class="fld"><span>指令(给 AI 的 prompt)</span>
                    <textarea v-model="form.prompt" rows="5" placeholder="比如:读取我最近的笔记,整理成一份今日早报,写进一条新笔记。"></textarea>
                </label>
                <label class="fld"><span>定时(cron,UTC)</span><input v-model="form.cron" placeholder="0 22 * * *" /></label>
                <div class="presets">
                    <button v-for="p in PRESETS" :key="p.cron" class="preset" @click="form.cron = p.cron">{{ p.label }}</button>
                </div>
                <label class="chk"><input type="checkbox" v-model="form.needs_device" /> 需要设备在线(离线则跳过)</label>
                <label class="chk"><input type="checkbox" v-model="form.enabled" /> 启用</label>
                <button class="save" @click="save">保存</button>
            </div>
        </div>
    </section>
</template>

<style scoped>
.head { flex-shrink: 0; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--color-line); background: var(--color-bg); padding: 10px 12px; }
.head-title { flex: 1; min-width: 0; font-size: 15px; font-weight: 850; color: var(--color-ink); }
.add { padding: 6px 12px; border-radius: 9px; background: var(--color-accent); color: var(--color-bg); font-size: 13px; font-weight: 750; }
.add.ghost { background: var(--color-bg-elev); color: var(--color-muted); border: 1px solid var(--color-line); }
.wrap { padding: 14px; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.empty { color: var(--color-muted); font-size: 13px; padding: 30px 10px; text-align: center; line-height: 1.7; }
.task { border: 1px solid var(--color-line); border-radius: 14px; background: var(--color-bg-elev); overflow: hidden; }
.task-main { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
.sw { width: 38px; height: 22px; border-radius: 999px; background: var(--well); position: relative; flex-shrink: 0; transition: background .15s; }
.sw.on { background: var(--win); }
.sw span { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 999px; background: #fff; transition: left .15s; box-shadow: 0 1px 3px #0003; }
.sw.on span { left: 18px; }
.task-info { flex: 1; min-width: 0; text-align: left; }
.task-name { font-size: 14px; font-weight: 750; color: var(--color-ink); }
.task-sub { display: flex; align-items: center; gap: 7px; margin-top: 3px; flex-wrap: wrap; }
.task-sub code { font-size: 11.5px; color: var(--color-muted); background: var(--well); padding: 1px 6px; border-radius: 5px; }
.tag { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--well); color: var(--color-muted); }
.tag.done { background: var(--win-soft); color: var(--win); }
.tag.error { background: color-mix(in srgb, var(--color-danger, #d4564e) 16%, transparent); color: var(--color-danger, #d4564e); }
.task-ops { display: flex; gap: 4px; flex-shrink: 0; }
.op { width: 30px; height: 30px; border-radius: 8px; color: var(--color-muted); font-size: 13px; transition: background .12s, color .12s; }
.op:hover { background: var(--well); color: var(--color-ink); }
.op.danger:hover { color: var(--color-danger, #d4564e); }
.runs { border-top: 1px solid var(--color-line); padding: 8px 14px 12px; display: flex; flex-direction: column; gap: 6px; }
.runs-loading, .runs-empty { color: var(--color-faint); font-size: 12px; padding: 6px 0; }
.run { display: flex; align-items: baseline; gap: 8px; font-size: 12px; }
.run-st { flex-shrink: 0; font-weight: 700; }
.run-st.done { color: var(--win); } .run-st.error { color: var(--color-danger, #d4564e); } .run-st.skipped { color: var(--color-faint); }
.run-time { flex-shrink: 0; color: var(--color-faint); }
.run-sum { color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.form .fld { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--color-muted); }
.form input, .form textarea { border: 1px solid var(--color-line); border-radius: 10px; padding: 9px 11px; background: var(--color-bg-elev); color: var(--color-ink); font-size: 14px; font-weight: 400; }
.form textarea { resize: vertical; line-height: 1.6; }
.presets { display: flex; flex-wrap: wrap; gap: 6px; }
.preset { padding: 5px 10px; border-radius: 8px; border: 1px solid var(--color-line); background: var(--color-bg-elev); color: var(--color-muted); font-size: 12px; }
.preset:hover { border-color: var(--color-accent); color: var(--color-ink); }
.chk { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-ink); }
.save { margin-top: 4px; height: 42px; border-radius: 11px; background: var(--color-accent); color: var(--color-bg); font-weight: 750; }
</style>
