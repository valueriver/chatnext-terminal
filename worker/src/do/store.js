// DO 内的易失状态:进行中工具调用的等待表(callId → resolve)。
// ⚠️ 这是内存态,只在 turn 活跃期间有效;DO 被驱逐则丢失。
//   跨休眠硬化时,改为把 pending 落 ctx.storage,设备结果事件唤醒后兑现。
export function makePending() {
    const pending = new Map(); // callId -> { resolve, reject, timer }
    let seq = 0;

    return {
        // 新建一个等待,返回 { callId, promise }
        create(timeoutMs = 5 * 60 * 1000) {
            const callId = `c${Date.now()}_${++seq}`;
            const promise = new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending.delete(callId);
                    resolve({ error: '设备执行超时' });
                }, timeoutMs);
                pending.set(callId, { resolve, reject, timer });
            });
            return { callId, promise };
        },

        // 设备结果回来:兑现对应等待
        resolve(callId, result) {
            const p = pending.get(callId);
            if (!p) return false;
            clearTimeout(p.timer);
            pending.delete(callId);
            p.resolve(result);
            return true;
        },
    };
}
