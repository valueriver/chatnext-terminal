const pty = require('node-pty');
const WebSocket = require('ws');
const os = require('os');
const config = require('./config');

class TerminalClient {
    constructor() {
        this.ws = null;
        this.ptyProcess = null;
        this.sessionId = this.generateSessionId();
        this.serverUrl = config.serverUrl;
    }

    generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    start() {
        console.log('🚀 Terminal 启动中...');
        
        // 创建终端进程
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        this.ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env
        });

        // 监听终端输出
        this.ptyProcess.onData((data) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'data.output',
                    to: 'web',
                    data: {
                        output: data
                    }
                });
            }
        });

        // 监听终端退出
        this.ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`终端进程退出: code ${exitCode}, signal ${signal}`);
        });

        this.connect();
    }

    connect() {
        const wsUrl = `${this.serverUrl}/ws?session=${this.sessionId}`;
        console.log(`连接服务器: ${wsUrl}`);
        
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            console.log('✅ 已连接到服务器');
            
            // 注册设备
            this.send({
                type: 'connection.devices',
                to: 'server',
                data: {
                    deviceType: 'desktop',
                    status: 'connected'
                }
            });

            const webUrl = `${config.webUrl}?session=${this.sessionId}`;
            console.log('🔗 访问链接:');
            console.log(`   ${webUrl}`);
            console.log('');
            console.log('💡 在手机或其他设备的浏览器中打开上述链接即可使用');
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (error) {
                console.error('解析消息失败:', error);
            }
        });

        this.ws.on('close', () => {
            console.log('❌ 与服务器断开连接，3秒后重连...');
            setTimeout(() => this.connect(), 3000);
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket错误:', error.message);
        });
    }

    handleMessage(message) {
        switch (message.type) {
            case 'connection.ping':
                this.send({ type: 'connection.pong', to: 'server', data: {} });
                break;
                
            case 'data.input':
                if (this.ptyProcess) {
                    this.ptyProcess.write(message.data.input);
                }
                break;

            case 'connection.devices':
                // 处理设备状态广播
                if (message.data.devices) {
                    const webConnected = message.data.devices.web === 'connected';
                    if (webConnected) {
                        console.log('🌐 网页端已连接');
                    }
                }
                break;

            case 'system.init':
            case 'system.resize':
                // 处理终端尺寸调整
                if (message.data.cols && message.data.rows && this.ptyProcess) {
                    this.ptyProcess.resize(message.data.cols, message.data.rows);
                    console.log(`🔄 终端尺寸调整为: ${message.data.cols}x${message.data.rows}`);
                }
                break;

            case 'system.command':
                // 处理系统命令
                const command = message.data.command;
                switch (command) {
                    case 'restart':
                        console.log('🔄 重启终端进程...');
                        this.restartPty();
                        break;
                    case 'clear':
                        if (this.ptyProcess) {
                            this.ptyProcess.write('\x1b[2J\x1b[H');
                        }
                        break;
                    case 'ctrl_c':
                        if (this.ptyProcess) {
                            this.ptyProcess.write('\x03');
                        }
                        break;
                    default:
                        console.log('未知系统命令:', command);
                }
                break;

            default:
                console.log('未知消息类型:', message.type);
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    restartPty() {
        // 关闭现有PTY进程
        if (this.ptyProcess) {
            this.ptyProcess.kill();
        }

        // 重新创建终端进程
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        this.ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env
        });

        // 重新绑定事件监听器
        this.ptyProcess.onData((data) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'data.output',
                    to: 'web',
                    data: {
                        output: data
                    }
                });
            }
        });

        this.ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`终端进程退出: code ${exitCode}, signal ${signal}`);
        });


        console.log('✅ 终端进程已重启');
    }
}

// 启动客户端
const client = new TerminalClient();
client.start();

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n正在关闭...');
    if (client.ptyProcess) {
        client.ptyProcess.kill();
    }
    if (client.ws) {
        client.ws.close();
    }
    process.exit(0);
});