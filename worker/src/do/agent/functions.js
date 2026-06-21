// 真正执行处。一个入口,内部分流:
//   云端原生工具(碰 D1)→ 就地执行,直接返回
//   设备工具(shell/computer_*/browser_cdp)→ 经 hub 下发选中设备,等结果回来
//
// hub 约定(由 do/index.js 注入):
//   hub.db                      D1 句柄
//   hub.callDevice(name, args)  → Promise<result>(经 dispatch 派给选中设备,按 callId 关联)
// 云端原生工具:名字 → 实现。其余一律走设备。
// sql:在云端 D1 上执行任意 SQL,全权,无护栏。
const CLOUD = {
    async sql(args, hub) {
        const q = String(args.query || '').trim();
        if (!q) return { error: '空查询' };
        try {
            if (/^(select|with|pragma)\b/i.test(q)) {
                const { results } = await hub.db.prepare(q).all();
                return { rows: results, count: results.length };
            }
            const r = await hub.db.prepare(q).run();
            return { ok: true, changes: r.meta?.changes ?? 0, lastRowId: Number(r.meta?.last_row_id) || 0 };
        } catch (err) {
            return { error: err.message || String(err) };
        }
    },
};

export async function execute(name, args, hub) {
    const cloud = CLOUD[name];
    if (cloud) return cloud(args, hub);

    // 设备工具:必须有在线设备
    if (!hub.hasDevice()) {
        return { error: '没有在线设备,无法执行设备工具。请上线一台设备后重试。' };
    }
    // device 是路由参数,不传给设备执行器;省略则由 hub 选当前在线设备
    const { device, ...rest } = args || {};
    return hub.callDevice(name, rest, device);
}
