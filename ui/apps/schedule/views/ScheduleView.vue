<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useScheduleStore } from '@/apps/schedule/store';
import { useTasksStore } from '@/apps/tasks/store';
import { useWsStore } from '@/system/stores/ws';
import { pill, fmtTime } from '@/apps/tasks/lib';
import TaskDetail from '@/apps/tasks/TaskDetail.vue';
import AppPanel from '@/system/components/AppPanel.vue';

const sc = useScheduleStore();
const tasks = useTasksStore();
const ws = useWsStore();

const form = reactive({ prompt: '', mode: 'daily', atTime: '09:00', atMin: 30, atDate: '' });
const creating = ref(false);
const expandedId = ref(null);

const MODES = [
    { key: 'daily', icon: '☀️', label: '每天' },
    { key: 'interval', icon: '🔄', label: '间隔' },
    { key: 'once', icon: '📌', label: '一次性' },
];

const ruleText = (s) => {
    if (s.mode === 'once') return `${s.at ? new Date(Number(s.at)).toLocaleString() : '?'}`;
    if (s.mode === 'interval') return `每 ${s.at} 分钟`;
    return `每天 ${s.at}`;
};
const modeIcon = (m) => MODES.find(x => x.key === m)?.icon || '📌';
const modeLabel = (m) => MODES.find(x => x.key === m)?.label || m;

const activeCount = computed(() => sc.items.filter(r => r.enabled).length);
const curSchedule = computed(() => sc.items.find(s => s.id === sc.openId));
const task = computed(() => tasks.detail.task);

async function create() {
    const prompt = form.prompt.trim();
    if (!prompt || !ws.canUseActions || creating.value) return;
    let at = '';
    if (form.mode === 'once') { if (!form.atDate) return; at = String(new Date(form.atDate).getTime()); }
    else if (form.mode === 'daily') { at = form.atTime || '09:00'; }
    else { at = String(Math.max(1, Number(form.atMin) || 30)); }
    creating.value = true;
    await sc.save({ name: prompt.slice(0, 30), prompt, mode: form.mode, at });
    form.prompt = '';
    creating.value = false;
}

function openTask(id) { tasks.open(id); }
function back() { if (tasks.openId) tasks.close(); else if (sc.openId) sc.close(); }

async function load() { if (ws.canUseActions) await sc.load(); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <button v-if="sc.openId || tasks.openId" class="text-muted hover:text-ink text-[18px] -ml-1 px-1" title="返回" @click="back">‹</button>
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink truncate">
                {{ tasks.openId ? (task?.name || '任务') : (sc.openId ? (curSchedule?.name || '排程') : '排程') }}
            </div>
            <span v-if="!sc.openId && !tasks.openId" class="text-[11px] font-bold text-faint">{{ activeCount }} 个活跃 / {{ sc.items.length }} 个规则</span>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <!-- L2 任务详情 -->
                <TaskDetail v-if="tasks.openId && task" :task="task" :messages="tasks.detail.messages" @abort="tasks.abort(task.id)" />

                <!-- L1 某排程触发的任务 -->
                <template v-else-if="sc.openId">
                    <div v-if="curSchedule" class="rounded-[16px] bg-bg-elev border border-line px-4 py-3.5 mb-4">
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="text-[16px]">{{ modeIcon(curSchedule.mode) }}</span>
                            <span class="text-accent-hi text-[12px] font-bold font-mono">{{ ruleText(curSchedule) }}</span>
                            <span class="text-[9px] font-extrabold rounded-full px-2 py-0.5" :class="curSchedule.enabled ? 'bg-good/12 text-good' : 'bg-bg-hi text-faint'">{{ modeLabel(curSchedule.mode) }}</span>
                        </div>
                        <div class="text-[13.5px] text-ink whitespace-pre-wrap break-words">{{ curSchedule.prompt }}</div>
                    </div>
                    <div class="text-[10px] font-extrabold text-faint tracking-widest uppercase mb-2 ml-1">触发的任务</div>
                    <div class="flex flex-col gap-2">
                        <button v-for="it in sc.runs" :key="it.id" class="text-left rounded-[13px] bg-bg-elev border border-line px-3.5 py-3 hover:border-line-hi transition" @click="openTask(it.id)">
                            <div class="flex items-center gap-2">
                                <span class="text-[11px] font-bold rounded-full px-2 py-0.5" :class="pill(it.status).cls">{{ pill(it.status).label }}</span>
                                <span class="flex-1"></span>
                                <span class="text-faint text-[11px]">{{ fmtTime(it.created_at) }}</span>
                            </div>
                        </button>
                        <div v-if="!sc.runs.length" class="text-muted text-[13px] text-center py-10">还没触发过任务。</div>
                    </div>
                </template>

                <!-- L0 创建 + 列表 -->
                <template v-else>
                    <!-- 创建表单 -->
                    <div class="rounded-[18px] bg-bg-elev border border-line p-4 mb-4 shadow-sm">
                        <input v-model="form.prompt" :disabled="!ws.canUseActions" placeholder="AI 要执行的指令…" spellcheck="false"
                            class="w-full h-[40px] px-3.5 rounded-[12px] bg-bg border-[1.5px] border-line-hi text-[13px] text-ink outline-none focus:border-accent transition mb-2.5" @keydown.enter="create" />
                        <div class="flex gap-1 mb-2.5">
                            <button v-for="m in MODES" :key="m.key"
                                class="flex-1 text-center py-2 rounded-[10px] text-[11px] font-bold transition"
                                :class="form.mode === m.key ? 'bg-accent/15 text-accent-hi' : 'bg-bg text-faint hover:text-ink'"
                                @click="form.mode = m.key">{{ m.icon }} {{ m.label }}</button>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] text-faint font-semibold">{{ form.mode === 'daily' ? '每天' : form.mode === 'interval' ? '每隔' : '在' }}</span>
                            <input v-if="form.mode === 'daily'" v-model="form.atTime" type="time"
                                class="w-20 h-[40px] px-2.5 rounded-[12px] bg-bg border-[1.5px] border-line-hi text-[13px] font-semibold font-mono text-ink text-center outline-none focus:border-accent transition" />
                            <template v-else-if="form.mode === 'interval'">
                                <input v-model.number="form.atMin" type="number" min="1"
                                    class="w-20 h-[40px] px-2.5 rounded-[12px] bg-bg border-[1.5px] border-line-hi text-[13px] font-semibold font-mono text-ink text-center outline-none focus:border-accent transition" />
                                <span class="text-[11px] text-faint font-semibold">分钟</span>
                            </template>
                            <input v-else v-model="form.atDate" type="datetime-local"
                                class="flex-1 h-[40px] px-2.5 rounded-[12px] bg-bg border-[1.5px] border-line-hi text-[13px] font-mono text-ink outline-none focus:border-accent transition" />
                            <span class="text-[11px] text-faint font-semibold">{{ form.mode !== 'once' ? '执行' : '' }}</span>
                            <div class="flex-1"></div>
                            <button class="h-[40px] px-5 rounded-[12px] bg-gradient-to-br from-accent to-accent-hi text-white text-[12px] font-bold shadow-md hover:-translate-y-px transition shrink-0 disabled:opacity-45"
                                :disabled="!form.prompt.trim() || !ws.canUseActions || creating" @click="create">+ 添加规则</button>
                        </div>
                    </div>

                    <!-- 规则列表 -->
                    <div v-if="sc.items.length" class="text-[10px] font-extrabold text-faint tracking-widest uppercase mb-2 ml-1">🟢 规则列表</div>
                    <div class="flex flex-col gap-2">
                        <div v-for="s in sc.items" :key="s.id"
                            class="group relative rounded-[16px] bg-bg-elev border border-line overflow-hidden transition"
                            :class="s.enabled ? '' : 'opacity-50'">
                            <div class="flex items-center gap-3 px-4 py-3 cursor-pointer" @click="sc.tasksOf(s.id)">
                                <div class="w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px] shrink-0"
                                    :class="s.mode === 'daily' ? 'bg-accent/12' : s.mode === 'interval' ? 'bg-good/12' : 'bg-warn/12'">
                                    {{ modeIcon(s.mode) }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-[12.5px] font-bold text-ink truncate">{{ s.prompt }}</div>
                                    <div class="text-[10.5px] text-faint mt-0.5 flex items-center gap-1.5">
                                        <span class="font-mono text-[10px] bg-bg-hi rounded px-1.5 py-px text-accent-hi">{{ ruleText(s) }}</span>
                                        <span v-if="s.last_run">· 上次 {{ fmtTime(s.last_run) }}</span>
                                    </div>
                                </div>
                                <span class="text-[9px] font-extrabold rounded-full px-2 py-0.5"
                                    :class="s.mode === 'daily' ? 'bg-accent/12 text-accent' : s.mode === 'interval' ? 'bg-good/12 text-good' : 'bg-warn/12 text-warn'">
                                    {{ modeLabel(s.mode) }}
                                </span>
                                <button class="shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5"
                                    :class="s.enabled ? 'text-good bg-good/12' : 'text-faint bg-bg-hi'"
                                    @click.stop="sc.toggle(s.id, !s.enabled)">{{ s.enabled ? '启用' : '停用' }}</button>
                                <button class="shrink-0 text-faint hover:text-bad text-[12px] opacity-0 group-hover:opacity-100 transition" @click.stop="sc.remove(s.id)">删除</button>
                            </div>
                        </div>
                    </div>

                    <div v-if="!sc.items.length" class="text-center py-16">
                        <div class="text-[40px] opacity-50 mb-3">🗓️</div>
                        <div class="text-muted text-[13px]">{{ ws.canUseActions ? '还没有排程' : '未连接本机 Server' }}</div>
                        <div v-if="ws.canUseActions" class="text-faint text-[12px] mt-1">上面创建一条定时规则</div>
                    </div>
                </template>
            </div>
        </div>
    </section>
</template>
