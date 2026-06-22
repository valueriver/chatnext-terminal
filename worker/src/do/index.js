// OneHub:账户活体运行时。WS Hibernation 入口 + 事件分发;agent 住在里面跑。
// 单用户 · 单设备 → 全局唯一实例(idFromName('one'))。
//
// 连接(WS 升级在 /do/ws):
//   ?role=web      网页端:发聊天、收流式;终端/屏幕等设备消息的转发对端
//   ?role=device   这台设备:收工具/转发请求,回结果
//
// 消息协议:统一用 type 判别,按 app 前缀路由(chat.* / fs.* / terminal.* / …)。
//   web → DO:    { type:'chat.send', chatId, text } / { type:'chat.abort', chatId }  其余转发给设备
//   DO → web:    { type:'chat.event', … } 单一直播通道;另有 { type:'device', online, name }
//   DO → device: { type:'tool.exec', callId, name, args } 其余原样转发
//   device → DO: { type:'tool.result', callId, result }   其余原样转发给 web
import { makeDispatch } from './dispatch.js';
import { makePending } from './store.js';
import { runTurn } from './agent/loop.js';
import { verify } from '../system/identity/service.js';
import * as deviceRepo from '../system/identity/repository.js';

export class OneHub {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
        this.db = env.DB;
        this.dispatch = makeDispatch(ctx);
        this.pending = makePending();
        this.aborters = new Map(); // chatId → AbortController(进行中的 turn,供中断)
    }

    async fetch(request) {
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('hub', { status: 200 });

        const url = new URL(request.url);
        // 鉴权:WS 走 ?token=。role 从 JWT 取,不信任 query。
        const payload = await verify({ env: this.env }, url.searchParams.get('token'));
        if (!payload) return new Response('unauthorized', { status: 401 });
        const isDevice = payload.role === 'device';
        const tag = isDevice ? 'device' : 'web';

        const { 0: client, 1: server } = new WebSocketPair();
        this.ctx.acceptWebSocket(server, [tag]);
        if (isDevice) await deviceRepo.touch(this.db, Date.now()).catch(() => {});
        else this.dispatch.toDevice({ type: 'web.connected' }); // 网页接入 → 让设备推快照(终端等)
        this.broadcastDevice();
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws, raw) {
        let msg; try { msg = JSON.parse(raw); } catch { return; }
        const tags = this.ctx.getTags(ws) || [];
        if (tags.includes('device')) return this.fromDevice(msg);
        return this.fromWeb(msg);
    }

    async webSocketClose() { this.broadcastDevice(); }

    // ── 网页端来的 ──
    async fromWeb(msg) {
        if (msg.type === 'chat.send') {
            const ac = new AbortController();
            this.aborters.set(msg.chatId, ac);
            return runTurn(this.hub(), msg.chatId, { text: msg.text, attachments: msg.attachments }, ac.signal)
                .catch((e) => this.dispatch.toWeb({ type: 'chat.event', chatId: msg.chatId, kind: 'error', content: e.message || String(e) }))
                .finally(() => { if (this.aborters.get(msg.chatId) === ac) this.aborters.delete(msg.chatId); });
        }
        if (msg.type === 'chat.abort') {
            this.aborters.get(msg.chatId)?.abort();
            return;
        }
        // 其余(终端/文件/屏幕)→ 转发给设备
        this.dispatch.toDevice(msg);
    }

    // ── 设备来的 ──
    fromDevice(msg) {
        if (msg.type === 'tool.result') { this.pending.resolve(msg.callId, msg.result); return; }
        // 其余(终端输出/截图等)→ 转发给网页端
        this.dispatch.toWeb(msg);
    }

    // agent loop / tick 用的句柄:把 DO 能力收口成一个对象注入
    hub() {
        const dispatch = this.dispatch;
        const pending = this.pending;
        const db = this.db;
        return {
            db,
            toWeb: (m) => dispatch.toWeb(m),
            hasDevice: () => dispatch.hasDevice(),
            // 这台设备的真实信息,喂给 prompt。不在线 → null
            async device() {
                if (!dispatch.hasDevice()) return null;
                const row = await deviceRepo.get(db).catch(() => null);
                return { name: row?.name || '设备', capabilities: row?.capabilities || [] };
            },
            // 派工具给设备 + 等结果(按 callId 关联)
            callDevice: (name, args) => {
                const { callId, promise } = pending.create();
                const sent = dispatch.toDevice({ type: 'tool.exec', callId, name, args });
                if (!sent) return Promise.resolve({ error: '没有在线设备' });
                return promise;
            },
        };
    }

    async broadcastDevice() {
        const row = await deviceRepo.get(this.db).catch(() => null);
        this.dispatch.toWeb({
            type: 'device',
            online: this.dispatch.hasDevice(),
            name: row?.name || '',
            paired: Boolean(row),
        });
    }
}
