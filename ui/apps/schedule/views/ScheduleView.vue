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

// 新建排程表单
const form = reactive({ name: '', prompt: '', mode: 'daily', atDate: '', atTime: '09:00', atMin: 30 });
const creating = ref(false);

const ruleText = (s) => {
    if (s.mode === 'once') return `一次 · ${s.at ? new Date(Number(s.at)).toLocaleString() : '?'}`;
    if (s.mode === 'interval') return `每 ${s.at} 分钟`;
    return `每天 ${s.at}`;
};

async function create() {
    const prompt = form.prompt.trim();
    if (!prompt || !ws.canUseActions || creating.value) return;
    let at = '';
    if (form.mode === 'once') { if (!form.atDate) return; at = String(new Date(form.atDate).getTime()); }
    else if (form.mode === 'daily') { at = form.atTime || '09:00'; }
    else { at = String(Math.max(1, Number(form.atMin) || 30)); }
    creating.value = true;
    await sc.save({ name: (form.name.trim() || prompt).slice(0, 30), prompt, mode: form.mode, at });
    form.prompt = ''; form.name = '';
    creating.value = false;
}

const curSchedule = computed(() => sc.items.find((s) => s.id === sc.openId));
const task = computed(() => tasks.detail.task);

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
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <!-- L2 任务详情 -->
                <TaskDetail v-if="tasks.openId && task" :task="task" :messages="tasks.detail.messages" @abort="tasks.abort(task.id)" />

                <!-- L1 某排程触发的任务 -->
                <template v-else-if="sc.openId">
                    <div v-if="curSchedule" class="rounded-[13px] bg-bg-elev border border-line px-3.5 py-3 mb-4">
                        <div class="text-accent-hi text-[12px] font-bold">{{ ruleText(curSchedule) }}</div>
                        <div class="text-[13.5px] text-ink mt-1 whitespace-pre-wrap break-words">{{ curSchedule.prompt }}</div>
                    </div>
                    <div class="text-muted text-[11px] font-bold tracking-wider mb-1.5">触发的任务</div>
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

                <!-- L0 居中 hero + 排程列表 -->
                <template v-else>
                    <div class="flex flex-col items-center text-center pt-4 pb-7">
                        <div class="text-[28px] font-extrabold text-ink tracking-tight">排程</div>
                        <p class="text-muted text-[13px] mt-2 max-w-md leading-relaxed">定时把任务交给 AI —— 可一次性，可循环。每条排程触发的任务都记在它名下。</p>

                        <div class="mt-6 w-full max-w-xl rounded-2xl bg-bg-elev border border-line p-3 text-left">
                            <textarea v-model="form.prompt" :disabled="!ws.canUseActions" rows="2" placeholder="到点让 AI 做什么…" spellcheck="false"
                                class="w-full bg-transparent outline-none resize-none text-[14px] leading-6 text-ink"></textarea>
                            <div class="flex flex-wrap items-center gap-2 mt-2">
                                <select v-model="form.mode" class="bg-bg-hi border border-line rounded-lg px-2 py-1.5 text-[13px] text-ink outline-none">
                                    <option value="daily">每天</option>
                                    <option value="interval">间隔</option>
                                    <option value="once">一次</option>
                                </select>
                                <input v-if="form.mode === 'daily'" v-model="form.atTime" type="time" class="bg-bg-hi border border-line rounded-lg px-2 py-1.5 text-[13px] text-ink outline-none" />
                                <template v-else-if="form.mode === 'interval'">
                                    <input v-model.number="form.atMin" type="number" min="1" class="w-20 bg-bg-hi border border-line rounded-lg px-2 py-1.5 text-[13px] text-ink outline-none" />
                                    <span class="text-muted text-[12px]">分钟</span>
                                </template>
                                <input v-else v-model="form.atDate" type="datetime-local" class="bg-bg-hi border border-line rounded-lg px-2 py-1.5 text-[13px] text-ink outline-none" />
                                <span class="flex-1"></span>
                                <button class="cta" :disabled="!form.prompt.trim() || !ws.canUseActions || creating" @click="create">{{ creating ? '创建中…' : '创建排程' }}</button>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div v-for="s in sc.items" :key="s.id" class="group rounded-[13px] bg-bg-elev border border-line px-3.5 py-3" :class="s.enabled ? '' : 'opacity-55'">
                            <div class="flex items-center gap-2">
                                <button class="text-left flex-1 min-w-0" @click="sc.tasksOf(s.id)">
                                    <span class="text-accent-hi text-[12px] font-bold">{{ ruleText(s) }}</span>
                                    <span v-if="s.last_run" class="text-faint text-[11px] ml-2">上次 {{ fmtTime(s.last_run) }}</span>
                                    <div class="text-ink text-[13.5px] mt-0.5 truncate">{{ s.prompt }}</div>
                                </button>
                                <button class="shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5" :class="s.enabled ? 'text-good bg-good/12' : 'text-muted bg-bg-hi'" @click="sc.toggle(s.id, !s.enabled)">{{ s.enabled ? '启用' : '停用' }}</button>
                                <button class="shrink-0 text-muted hover:text-bad text-[12px] opacity-0 group-hover:opacity-100 transition" @click="sc.remove(s.id)">删除</button>
                            </div>
                        </div>
                        <div v-if="!sc.items.length" class="text-muted text-[13px] text-center py-8">
                            {{ ws.canUseActions ? '还没有排程。上面建一条。' : '未连接本机 Server。' }}
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </section>
</template>
