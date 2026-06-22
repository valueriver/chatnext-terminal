// 工具执行器:云端 tool.exec 的本机实现。函数名 = 云端 tools.js 的工具名。
// shell + 浏览器(browser_cdp 经 CDP 桥)+ 电脑(cliclick/osascript)。sql 不在这(云端原生)。
import { exec } from 'child_process';
import os from 'os';
import ws from './channel.js';
import cdpBridge from './system/browser/bridge.js';
import * as computer from './system/computer/index.js';

// 截图:推给网页端看(base64),回给模型一句说明(不塞 base64,免爆 token)。
function pushScreenshot(dataUrl, screen, label) {
    try { ws.broadcast('chat.screenshot', { dataUrl, screen, label, at: Date.now() }); } catch { /* ignore */ }
}

const TIMEOUT_DEFAULT_MS = 30 * 1000;
const TIMEOUT_MIN_MS = 1000;
const TIMEOUT_MAX_MS = 5 * 60 * 1000;
const MAX_BUFFER = 4 * 1024 * 1024;

const resolveTimeoutMs = (timeout) => {
    if (timeout == null) return TIMEOUT_DEFAULT_MS;
    const seconds = Number(timeout);
    if (!Number.isFinite(seconds)) return TIMEOUT_DEFAULT_MS;
    return Math.min(Math.max(seconds * 1000, TIMEOUT_MIN_MS), TIMEOUT_MAX_MS);
};

// shell 不限制目录(与终端能力一致),默认主目录。
export const shell = ({ command, cwd, timeout } = {}) => new Promise((resolve) => {
    exec(String(command || ''), {
        cwd: String(cwd || '').trim() || os.homedir(),
        env: process.env,
        shell: process.env.SHELL || '/bin/sh',
        timeout: resolveTimeoutMs(timeout),
        maxBuffer: MAX_BUFFER,
    }, (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join('');
        if (error) { resolve(`exit code ${error.code ?? 1}\n${output || error.message}`); return; }
        resolve(output || '(no output)');
    });
});

// 浏览器:直发 CDP(经 browser-use 扩展)。默认作用于当前活动标签。
export const browser_cdp = async ({ method, params, tabId } = {}) => {
    if (!method) throw new Error('缺少 CDP method,例如 "Page.navigate"、"Runtime.evaluate"。');
    const result = await cdpBridge.cdp(method, params || {}, tabId);
    if (method === 'Page.captureScreenshot' && result?.data) {
        const mime = (params?.format === 'jpeg') ? 'image/jpeg' : 'image/png';
        pushScreenshot(`data:${mime};base64,${result.data}`, null, 'browser');
        return { ok: true, note: '已截取浏览器页面并推给用户查看。判断网页内容优先用 Runtime.evaluate 读 DOM;需据截图判断则改用视觉模型。' };
    }
    return result;
};

// 电脑(键鼠 / 截图)
export const computer_status = async () => computer.status();
export const computer_type = async ({ text } = {}) => computer.typeText({ text });
export const computer_key = async ({ key, modifiers } = {}) => computer.pressKey({ key, modifiers });
export const computer_click = async ({ x, y, button, clicks } = {}) => computer.click({ x, y, button, clicks });
export const computer_move = async ({ x, y } = {}) => computer.mouseMove({ x, y });
export const computer_scroll = async ({ direction, amount } = {}) => computer.scroll({ direction, amount });

export const computer_screenshot = async () => {
    const shot = await computer.screenshot();
    pushScreenshot(shot.dataUrl, shot.screen, 'desktop');
    return {
        ok: true,
        screen: shot.screen,
        note: `已截图(${Math.round((shot.bytes || 0) / 1024)}KB,${shot.screen?.width || '?'}×${shot.screen?.height || '?'}),已推给用户查看。需据屏幕内容判断请改用视觉模型。`,
    };
};

export const open_app = async ({ name } = {}) => new Promise((resolve) => {
    const n = String(name || '').trim();
    if (!n) { resolve('缺少应用名 name'); return; }
    if (process.platform !== 'darwin') { resolve('open_app 目前仅支持 macOS'); return; }
    exec(`open -a ${JSON.stringify(n)}`, { timeout: 15000 }, (error) => {
        resolve(error ? `打开失败: ${error.message}` : `已打开 ${n}`);
    });
});
