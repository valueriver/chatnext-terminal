import { DurableObject } from "cloudflare:workers";

// Terminal Session Manager - Durable Object  
export class TerminalSessionManager extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        this.sessions = new Map(); // sessionId -> { desktop: WebSocket, web: WebSocket }
    }

    // 处理WebSocket连接
    async webSocketMessage(ws, message) {
        try {
            const msg = JSON.parse(message);
            const sessionId = ws.sessionId; // 从WebSocket对象获取sessionId
            
            if (!sessionId) return; // 如果没有sessionId，忽略消息
            
            if (!this.sessions.has(sessionId)) {
                this.sessions.set(sessionId, {});
            }
            
            const session = this.sessions.get(sessionId);

            switch (msg.type) {
                case 'connection.devices':
                    // 设备连接状态
                    if (msg.data.deviceType === 'desktop' && msg.data.status === 'connected') {
                        session.desktop = ws;
                        console.log(`Desktop connected to session: ${sessionId}`);
                    } else if (msg.data.deviceType === 'web' && msg.data.status === 'connected') {
                        session.web = ws;
                        console.log(`Web connected to session: ${sessionId}`);
                    }
                    this.broadcastDeviceStatus(sessionId);
                    break;

                case 'data.input':
                    // 路由输入消息
                    if (msg.to === 'desktop' && session.desktop) {
                        this.forwardMessage(session.desktop, msg);
                    }
                    break;

                case 'data.output':
                    // 路由输出消息
                    if (msg.to === 'web' && session.web) {
                        this.forwardMessage(session.web, msg);
                    }
                    break;

                case 'system.init':
                case 'system.resize':
                case 'system.command':
                    // 路由系统控制消息
                    if (msg.to === 'desktop' && session.desktop) {
                        this.forwardMessage(session.desktop, msg);
                    } else if (msg.to === 'web' && session.web) {
                        this.forwardMessage(session.web, msg);
                    }
                    break;

                case 'connection.ping':
                    // 处理ping，回复pong
                    const pongMsg = {
                        type: 'connection.pong',
                        to: msg.data?.deviceType || 'web',
                        data: {}
                    };
                    ws.send(JSON.stringify(pongMsg));
                    break;
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    }

    // 转发消息
    forwardMessage(targetWs, message) {
        if (targetWs && targetWs.readyState === WebSocket.READY_STATE_OPEN) {
            targetWs.send(JSON.stringify(message));
        }
    }

    // 处理WebSocket连接关闭
    async webSocketClose(ws, code, reason, wasClean) {
        const sessionId = ws.sessionId;
        if (!sessionId) return;

        const session = this.sessions.get(sessionId);
        if (!session) return;

        // 清理断开的连接
        if (session.desktop === ws) {
            session.desktop = null;
            console.log(`Desktop disconnected from session: ${sessionId}`);
        } else if (session.web === ws) {
            session.web = null;
            console.log(`Web disconnected from session: ${sessionId}`);
        }

        // 广播状态更新
        this.broadcastDeviceStatus(sessionId);
        
        // 如果两端都断开了，删除会话
        if (!session.desktop && !session.web) {
            this.sessions.delete(sessionId);
            console.log(`Session deleted: ${sessionId}`);
        }
    }

    // 广播设备状态
    broadcastDeviceStatus(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const deviceStatus = {
            type: 'connection.devices',
            to: 'all',
            data: {
                devices: {
                    desktop: session.desktop ? 'connected' : 'disconnected',
                    web: session.web ? 'connected' : 'disconnected'
                }
            }
        };

        const statusMessage = JSON.stringify(deviceStatus);
        
        if (session.desktop && session.desktop.readyState === WebSocket.READY_STATE_OPEN) {
            session.desktop.send(statusMessage);
        }
        if (session.web && session.web.readyState === WebSocket.READY_STATE_OPEN) {
            session.web.send(statusMessage);
        }
    }

    // HTTP请求处理（用于升级WebSocket）
    async fetch(request) {
        const url = new URL(request.url);
        
        if (url.pathname === '/ws') {
            const upgradeHeader = request.headers.get('Upgrade');
            if (upgradeHeader !== 'websocket') {
                return new Response('Expected Upgrade: websocket', { status: 426 });
            }

            const webSocketPair = new WebSocketPair();
            const [client, server] = Object.values(webSocketPair);

            // 从URL参数获取sessionId并保存到WebSocket对象
            const sessionId = url.searchParams.get('session');
            server.sessionId = sessionId;

            // 先接受 WebSocket 连接
            server.accept();

            server.addEventListener('message', (event) => {
                this.webSocketMessage(server, event.data);
            });
            
            server.addEventListener('close', (event) => {
                this.webSocketClose(server, event.code, event.reason, event.wasClean);
            });

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }
        
        return new Response('Not Found', { status: 404 });
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // 处理WebSocket连接
        if (url.pathname === '/ws') {
            // 获取会话ID
            const sessionId = url.searchParams.get('session') || 'default';
            
            // 创建或获取对应的Durable Object
            const id = env.TERMINAL_SESSION_MANAGER.idFromName(sessionId);
            const stub = env.TERMINAL_SESSION_MANAGER.get(id);
            
            return stub.fetch(request);
        }
        
        // 处理静态文件
        return env.ASSETS.fetch(request);
    },
};