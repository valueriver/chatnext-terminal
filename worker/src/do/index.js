// AccountDO:账户活体运行时。WS Hibernation 入口 + 事件分发;agent 住在里面跑。
// 单用户 → 全局唯一实例(idFromName('one'))。
//
// 连接(WS 升级在 /do/ws):
//   ?role=web                网页端:发聊天、收流式;终端/屏幕等设备消息的转发对端
//   ?role=device&id=<id>     设备:收工具/转发请求,回结果
//
// 消息协议(provisional,待逐字敲死):
//   web → DO:    { t:'chat.send', chatId, text }      其余设备类消息原样转发给设备
//   DO → web:    chat.delta / chat.tool / chat.tool_result / chat.done / chat.error / devices
//   DO → device: { t:'tool.exec', callId, name, args } 其余原样转发
//   device → DO: { t:'tool.result', callId, result }   其余原样转发给 web
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
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('hub', { status: 200 });

        // 鉴权:WS 走 ?token=(浏览器无法在握手设 header)。role / 设备 id 从 JWT 取,不信任 query。
        const payload = await verify({ env: this.env }, url.searchParams.get('token'));
        if (!payload) return new Response('unauthorized', { status: 401 });
        const deviceId = payload.role === 'device' ? String(payload.id || '') : '';
        const tag = deviceId ? `device:${deviceId}` : 'web';

        const { 0: client, 1: server } = new WebSocketPair();
        this.ctx.acceptWebSocket(server, [tag]);
        if (deviceId) await deviceRepo.touch(this.db, deviceId, Date.now()).catch(() => {});
        else this.dispatch.toDevice({ t: 'web.connected' }); // 网页接入 → 让设备推快照(终端等)
        this.broadcastDevices();
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws, raw) {
        let msg; try { msg = JSON.parse(raw); } catch { return; }
        const tags = this.ctx.getTags(ws) || [];
        const isDevice = tags.some((t) => t.startsWith('device:'));

        if (isDevice) return this.fromDevice(msg);
        return this.fromWeb(msg);
    }

    async webSocketClose() { this.broadcastDevices(); }

    // ── 网页端来的 ──
    async fromWeb(msg) {
        if (msg.t === 'chat.send') {
            return runTurn(this.hub(), msg.chatId, msg.text).catch((e) =>
                this.dispatch.toWeb({ t: 'chat.error', chatId: msg.chatId, error: e.message || String(e) }));
        }
        // 其余(终端/文件/屏幕)→ 转发给消息指定的设备(msg.device);未指定则当前在线
        this.dispatch.toDevice(msg, msg.device);
    }

    // ── 设备来的 ──
    fromDevice(msg) {
        if (msg.t === 'tool.result') { this.pending.resolve(msg.callId, msg.result); return; }
        // 其余(终端输出/截图等)→ 转发给网页端
        this.dispatch.toWeb(msg);
    }

    // agent loop 用的句柄:把 DO 能力收口成一个对象注入
    hub() {
        const dispatch = this.dispatch;
        const pending = this.pending;
        return {
            db: this.db,
            toWeb: (m) => dispatch.toWeb(m),
            hasDevice: () => dispatch.hasDevice(),
            device: () => null, // ⚠️ 待接:从 devices 表取选中设备的能力,喂给 prompt
            // 派工具给设备 + 等结果(按 callId 关联)。deviceId 省略则 dispatch 选当前在线设备
            callDevice: (name, args, deviceId) => {
                const { callId, promise } = pending.create();
                const sent = dispatch.toDevice({ t: 'tool.exec', callId, name, args }, deviceId);
                if (!sent) return Promise.resolve({ error: deviceId ? `设备 ${deviceId} 不在线` : '没有在线设备' });
                return promise;
            },
        };
    }

    async broadcastDevices() {
        const rows = await deviceRepo.list(this.db).catch(() => []);
        const online = new Set(
            this.ctx.getWebSockets().flatMap((ws) => (this.ctx.getTags(ws) || []))
                .filter((t) => t.startsWith('device:')).map((t) => t.slice('device:'.length)),
        );
        const list = rows.map((d) => ({ id: d.id, name: d.name, online: online.has(d.id) }));
        this.dispatch.toWeb({ t: 'devices', devices: list });
    }
}
