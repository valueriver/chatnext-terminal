// 任务展示共享：状态徽标、时间、工具参数。tasks 与 schedule 复用。
export const STATUS = {
    pending: { label: '排队', cls: 'text-warn bg-warn/12' },
    running: { label: '运行中', cls: 'text-accent-hi bg-accent/15' },
    done: { label: '完成', cls: 'text-good bg-good/12' },
    error: { label: '失败', cls: 'text-bad bg-bad/12' },
    aborted: { label: '已中止', cls: 'text-muted bg-bg-hi' },
};
export const pill = (s) => STATUS[s] || STATUS.aborted;
export const isActive = (s) => s === 'pending' || s === 'running';
export const fmtTime = (ts) => {
    const t = Number(ts) || 0;
    if (!t) return '';
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const argsOf = (tc) => { try { return JSON.parse(tc.function?.arguments || '{}'); } catch { return {}; } };
