// 工具实现。函数名需与 tools.js 里的 function.name 对应。
// shell + 浏览器（browser_cdp，经 browser-use 扩展走 CDP）+ 电脑（cliclick/osascript）。
import { exec } from 'child_process';
import os from 'os';
import ws from '../../system/ws/index.js';
import cdpBridge from './cdp-bridge.js';
import * as computer from './computer.js';
import { getDb } from '../../system/core/db.js';
import { saveFile } from '../../system/attachments/index.js';

// 截图统一落盘 + 推给用户看 + 只回路径（不塞 base64，避免 token 爆炸）。
// 让模型“看”屏幕需视觉模型；目前默认非视觉，截图作为文件留存，路径回给模型。
function stashScreenshot(dataUrl, screen, label = 'screenshot') {
    let path = '';
    try {
        const saved = saveFile(dataUrl, `${label}-${Date.now()}.png`);
        path = saved?.path || '';
    } catch { /* 落盘失败不致命 */ }
    try { ws.broadcast('ai.screenshot', { dataUrl, screen, at: Date.now() }); } catch {}
    return path;
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

// roam 是用户自己的远程操控工具，shell 不限制目录（与终端能力一致），默认主目录。
const shell = ({ command, cwd, timeout } = {}) => new Promise((resolve) => {
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

// ───────── 浏览器：唯一工具，直发 CDP（经 browser-use 扩展） ─────────
// 默认作用于当前活动标签；绝大多数 DOM 操作用 Runtime.evaluate 跑 JS 即可。
const browser_cdp = async ({ method, params, tabId } = {}) => {
    if (!method) throw new Error('缺少 CDP method，例如 "Page.navigate"、"Runtime.evaluate"。');
    const result = await cdpBridge.cdp(method, params || {}, tabId);
    // 截图：不把 base64 回给模型（会被截断成垃圾且爆 token）。落盘 + 推给用户，回路径。
    if (method === 'Page.captureScreenshot' && result?.data) {
        const mime = (params?.format === 'jpeg') ? 'image/jpeg' : 'image/png';
        const path = stashScreenshot(`data:${mime};base64,${result.data}`, null, 'browser');
        return { ok: true, path, note: '已截取浏览器页面，推送到对话界面给用户查看。网页内容判断优先用 Runtime.evaluate 读 DOM；需据截图判断则改用支持视觉的模型。' };
    }
    return result;
};

// ───────── 电脑（键鼠/截图） ─────────
const computer_status = async () => computer.status();
const computer_type = async ({ text } = {}) => computer.typeText({ text });
const computer_key = async ({ key, modifiers } = {}) => computer.pressKey({ key, modifiers });
const computer_click = async ({ x, y, button, clicks } = {}) => computer.click({ x, y, button, clicks });
const computer_move = async ({ x, y } = {}) => computer.mouseMove({ x, y });
const computer_scroll = async ({ direction, amount } = {}) => computer.scroll({ direction, amount });

// 截图：抓屏 → 落盘 + 推给用户看，返回给模型路径与元信息（不塞 base64）。
const computer_screenshot = async () => {
    const shot = await computer.screenshot();
    const path = stashScreenshot(shot.dataUrl, shot.screen, 'desktop');
    return {
        ok: true,
        screen: shot.screen,
        path,
        note: `已截图（${Math.round((shot.bytes || 0) / 1024)}KB，${shot.screen?.width || '?'}×${shot.screen?.height || '?'}），已推送到对话界面给用户查看。若需我据屏幕内容判断，请改用支持视觉的模型。`,
    };
};

// 自我认知：在 roam.db 上读写。挡住改结构/毁库；settings 表(含 apiKey)不对 AI 开放。
const SQL_BLOCKED = /\b(drop|alter|attach|detach|truncate|vacuum|pragma|create\s+table|create\s+index)\b/i;
const sql = async ({ query } = {}) => {
    const q = String(query || '').trim();
    if (!q) return { error: '空查询' };
    if (SQL_BLOCKED.test(q)) return { error: '不允许改结构/毁库类操作(DROP/ALTER/PRAGMA 等)' };
    if (/\bsettings\b/i.test(q)) return { error: 'settings 表不对 AI 开放' };
    try {
        const db = getDb();
        const isSelect = /^(select|with)\b/i.test(q);
        if (isSelect) {
            const rows = db.prepare(q).all();
            return { rows: rows.slice(0, 100), count: rows.length };
        }
        const info = db.prepare(q).run();
        return { ok: true, changes: info.changes ?? 0, lastRowId: Number(info.lastInsertRowid) || 0 };
    } catch (err) {
        return { error: err.message || String(err) };
    }
};

const open_app = async ({ name } = {}) => new Promise((resolve) => {
    const n = String(name || '').trim();
    if (!n) { resolve('缺少应用名 name'); return; }
    if (process.platform !== 'darwin') { resolve('open_app 目前仅支持 macOS'); return; }
    exec(`open -a ${JSON.stringify(n)}`, { timeout: 15000 }, (error) => {
        resolve(error ? `打开失败: ${error.message}` : `已打开 ${n}`);
    });
});

export {
    shell,
    browser_cdp,
    computer_status, computer_type, computer_key, computer_click, computer_move, computer_scroll, computer_screenshot, open_app,
    sql,
};
