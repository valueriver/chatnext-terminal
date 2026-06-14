// 浏览器控制（本机 Google Chrome，经 AppleScript，取自 one）。
// 读页面/执行 JS 需在 Chrome「显示→开发者→允许 Apple 事件中的 JavaScript」打开，否则报错（已捕获并提示）。
import { execFile } from 'node:child_process';
import { screenshot as screenScreenshot } from './computer.js';

const APP = 'Google Chrome';

const run = (cmd, args, opts = {}) =>
    new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 20000, maxBuffer: 32 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
            if (err) { err.stderr = stderr; reject(err); return; }
            resolve(String(stdout));
        });
    });

const ensureMac = () => { if (process.platform !== 'darwin') throw new Error('浏览器控制当前仅支持 macOS + Chrome'); };
const osa = (script) => run('osascript', ['-e', script]);
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const isRunning = async () => {
    try {
        const out = await osa(`tell application "System Events" to (name of processes) contains "${APP}"`);
        return out.trim() === 'true';
    } catch { return false; }
};

const status = async () => {
    ensureMac();
    const running = await isRunning();
    let tabCount = 0;
    let active = null;
    if (running) {
        try {
            const out = await osa(`tell application "${APP}"
        set c to 0
        repeat with w in windows
          set c to c + (count of tabs of w)
        end repeat
        if (count of windows) > 0 then
          set t to active tab of front window
          return (c as string) & "\\n" & (title of t) & "\\n" & (URL of t)
        else
          return (c as string)
        end if
      end tell`);
            const [count, title, url] = out.split('\n');
            tabCount = parseInt(count, 10) || 0;
            if (url) active = { title: (title || '').trim(), url: url.trim() };
        } catch { /* ignore */ }
    }
    return { app: APP, running, tabCount, active };
};

const open = async ({ url }) => {
    ensureMac();
    const u = String(url || '').trim();
    if (!u) throw new Error('缺少 url');
    const full = /^[a-z]+:\/\//i.test(u) ? u : `https://${u}`;
    await osa(`tell application "${APP}"
    activate
    if (count of windows) = 0 then make new window
    tell front window to make new tab with properties {URL:"${esc(full)}"}
  end tell`);
    return { ok: true, url: full };
};

const navigate = async ({ url }) => {
    ensureMac();
    const u = String(url || '').trim();
    if (!u) throw new Error('缺少 url');
    const full = /^[a-z]+:\/\//i.test(u) ? u : `https://${u}`;
    await osa(`tell application "${APP}"
    activate
    if (count of windows) = 0 then make new window
    set URL of active tab of front window to "${esc(full)}"
  end tell`);
    return { ok: true, url: full };
};

const tabs = async () => {
    ensureMac();
    const out = await osa(`tell application "${APP}"
    set acc to ""
    set wi to 0
    repeat with w in windows
      set wi to wi + 1
      set ai to active tab index of w
      set ti to 0
      repeat with t in tabs of w
        set ti to ti + 1
        set mark to "0"
        if ti = ai then set mark to "1"
        set acc to acc & wi & "\\t" & ti & "\\t" & mark & "\\t" & (title of t) & "\\t" & (URL of t) & "\\n"
      end repeat
    end repeat
    return acc
  end tell`);
    const list = out.split('\n').filter(Boolean).map((line) => {
        const [w, t, mark, title, ...rest] = line.split('\t');
        return { window: Number(w), tab: Number(t), active: mark === '1', title: (title || '').trim(), url: rest.join('\t').trim() };
    });
    return { tabs: list };
};

const activateTab = async ({ window = 1, tab }) => {
    ensureMac();
    if (!tab) throw new Error('缺少 tab 序号');
    await osa(`tell application "${APP}"
    activate
    set index of window ${Number(window)} to 1
    set active tab index of window ${Number(window)} to ${Number(tab)}
  end tell`);
    return { ok: true, window: Number(window), tab: Number(tab) };
};

const closeTab = async ({ window = 1, tab }) => {
    ensureMac();
    if (!tab) throw new Error('缺少 tab 序号');
    await osa(`tell application "${APP}" to close tab ${Number(tab)} of window ${Number(window)}`);
    return { ok: true };
};

const evaluate = async ({ script }) => {
    ensureMac();
    const js = String(script || '');
    if (!js.trim()) throw new Error('缺少 script');
    try {
        const out = await osa(`tell application "${APP}" to execute active tab of front window javascript "${esc(js)}"`);
        return { ok: true, result: out.replace(/\n$/, '') };
    } catch (e) {
        if (/JavaScript|not allowed|Apple events/i.test(e.stderr || e.message || '')) {
            throw new Error('Chrome 未允许 Apple 事件执行 JavaScript：请在 Chrome「显示→开发者→允许 Apple 事件中的 JavaScript」开启');
        }
        throw e;
    }
};

const read = async ({ maxChars = 8000 } = {}) => {
    const { result } = await evaluate({ script: 'document.body && document.body.innerText' });
    const text = String(result || '');
    return { ok: true, text: text.slice(0, maxChars), truncated: text.length > maxChars };
};

const screenshot = async () => {
    ensureMac();
    try { await osa(`tell application "${APP}" to activate`); } catch { /* ignore */ }
    return screenScreenshot();
};

export { status, open, navigate, tabs, activateTab, closeTab, evaluate, read, screenshot };
