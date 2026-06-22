import { defineStore } from 'pinia';
import { nextTick, ref, watch } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useWsStore } from '@/system/stores/ws';
import { useToastStore } from '@/system/stores/toast';

// 两套终端配色，跟随 晴空(sky)/谧夜(night) 主题（与 style.css 的调色板对齐）
const TERMINAL_THEMES = {
    sky: {
        background: '#f7fbff',
        foreground: '#23303d',
        cursor: '#1c87dd',
        cursorAccent: '#f7fbff',
        selectionBackground: '#cfe6fb',
        black: '#23303d', red: '#d4564e', green: '#19a85e', yellow: '#c08a1d',
        blue: '#1c87dd', magenta: '#c2418f', cyan: '#188f99', white: '#7b8da0',
        brightBlack: '#46586c', brightRed: '#e0655c', brightGreen: '#1fb368',
        brightYellow: '#cf9a2b', brightBlue: '#3da5f5', brightMagenta: '#d65aa3',
        brightCyan: '#1fa3ad', brightWhite: '#23303d',
    },
    night: {
        background: '#1f2342',
        foreground: '#edefff',
        cursor: '#8e9bff',
        cursorAccent: '#1f2342',
        selectionBackground: '#3a4078',
        black: '#2b305c', red: '#ff8c84', green: '#4ce0a3', yellow: '#e8c268',
        blue: '#8e9bff', magenta: '#c799e6', cyan: '#7fd6d6', white: '#c3c9ec',
        brightBlack: '#9aa3d4', brightRed: '#ffa39c', brightGreen: '#73ecb8',
        brightYellow: '#f0d68a', brightBlue: '#a7b2ff', brightMagenta: '#dab0ee',
        brightCyan: '#9fe0e0', brightWhite: '#edefff',
    },
};

// 谧夜挂 data-theme="night"，晴空无属性（见 theme.js）
function pickTermTheme() {
    const night = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'night';
    return night ? TERMINAL_THEMES.night : TERMINAL_THEMES.sky;
}

const FONT_KEY = 'terminal_fontSize';
const HISTORY_KEY = 'terminal_history';
const PANEL_TAB_KEY = 'terminal_panel_tab';
const RECENT_DIRS_KEY = 'terminal_recent_dirs';
const HISTORY_MAX = 50;
const RECENT_DIRS_MAX = 8;
const MIN_FIT_WIDTH = 160;
const MIN_FIT_HEIGHT = 80;
const MIN_RESIZE_COLS = 20;
const MIN_RESIZE_ROWS = 4;
const FIT_RETRY_DELAYS = [0, 40, 120];

export const NAV_KEYS = [
    { label: 'Tab', code: '\t' },
    { label: 'Esc', code: '\x1b' },
    { label: '↑', code: '\x1b[A' },
    { label: '↓', code: '\x1b[B' },
    { label: '←', code: '\x1b[D' },
    { label: '→', code: '\x1b[C' },
    { label: 'PgUp', code: '\x1b[5~' },
    { label: 'PgDn', code: '\x1b[6~' },
    { label: 'Home', code: '\x1bOH' },
    { label: 'End', code: '\x1bOF' },
    { label: 'Space', code: ' ' },
    { label: 'Enter', code: '\r' },
];

export const CTRL_KEYS = [
    { label: '^C', code: '\x03' },
    { label: '^D', code: '\x04' },
    { label: '^L', code: '\x0c' },
    { label: '^R', code: '\x12' },
    { label: '^W', code: '\x17' },
    { label: '^U', code: '\x15' },
    { label: '^K', code: '\x0b' },
    { label: '^A', code: '\x01' },
    { label: '^E', code: '\x05' },
    { label: '^Z', code: '\x1a' },
];

const terminalInstances = new Map();
const fitAddons = new Map();
const terminalContainers = new Map();
const pendingOutput = new Map();
const pendingFits = new Map();

function queueOutput(terminalId, output) {
    if (!output) return;
    const current = pendingOutput.get(terminalId) || '';
    pendingOutput.set(terminalId, current + output);
}

function flushOutput(terminalId) {
    const term = terminalInstances.get(terminalId);
    const output = pendingOutput.get(terminalId);
    if (!term || !output) return;
    pendingOutput.delete(terminalId);
    term.write(output);
}

function isContainerReady(container) {
    if (!container || !container.isConnected) return false;
    const rect = container.getBoundingClientRect();
    return rect.width >= MIN_FIT_WIDTH && rect.height >= MIN_FIT_HEIGHT;
}

export const useTerminalStore = defineStore('terminal', () => {
    const ws = useWsStore();
    const toast = useToastStore();

    const fontSize = ref(Math.min(24, Math.max(10, parseInt(localStorage.getItem(FONT_KEY) || '14'))));
    const savedPanelTab = localStorage.getItem(PANEL_TAB_KEY);
    const activeTab = ref(savedPanelTab === 'keys' || savedPanelTab === 'commands' ? savedPanelTab : 'keys');
    const showPanel = ref(false);
    const inputText = ref('');
    const history = ref(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'));
    const recentDirs = ref(JSON.parse(localStorage.getItem(RECENT_DIRS_KEY) || '[]'));
    const terminalTabs = ref([]);
    const activeTerminalId = ref('');

    let historyIdx = history.value.length;
    let historyDraft = '';
    let ready = false;

    function activeTerminal() {
        return terminalTabs.value.find((item) => item.id === activeTerminalId.value) || terminalTabs.value[0] || null;
    }

    function terminalTitle(tab) {
        return tab?.title || tab?.cwd || 'Terminal';
    }

    function setTerminalTabs(items = [], preferredActiveId = '') {
        terminalTabs.value = items;
        const fallback = preferredActiveId
            || items.find((item) => item.isActive)?.id
            || items[0]?.id
            || '';
        activeTerminalId.value = fallback;

        for (const terminalId of [...terminalInstances.keys()]) {
            if (!items.some((item) => item.id === terminalId)) {
                terminalInstances.get(terminalId)?.dispose();
                terminalInstances.delete(terminalId);
                fitAddons.delete(terminalId);
                terminalContainers.delete(terminalId);
                pendingOutput.delete(terminalId);
            }
        }
    }

    function ensureTerminalInstance(terminalId) {
        if (!terminalId) return null;
        if (terminalInstances.has(terminalId)) return terminalInstances.get(terminalId);

        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: fontSize.value,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            scrollback: 5000,
            allowProposedApi: true,
            theme: pickTermTheme(),
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        try { terminal.loadAddon(new WebLinksAddon()); } catch {}

        terminal.onData((data) => {
            if (terminalId !== activeTerminalId.value) return;
            sendInputRaw(data);
        });
        terminal.onSelectionChange(() => {
            const sel = terminal.getSelection();
            if (sel && sel.trim() && navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(sel).catch(() => {});
            }
        });

        terminalInstances.set(terminalId, terminal);
        fitAddons.set(terminalId, fitAddon);

        const container = terminalContainers.get(terminalId);
        if (container && !terminal.element) {
            terminal.open(container);
            if (terminalId === activeTerminalId.value) fitTerminal(terminalId);
        }
        flushOutput(terminalId);
        return terminal;
    }

    function sendInputRaw(input) {
        const terminalId = activeTerminalId.value;
        if (!terminalId) return;
        ws.sendMsg({ type: 'data.input', to: 'desktop', data: { terminalId, input } });
    }

    function sendResize(terminalId = activeTerminalId.value) {
        if (!terminalId) return;
        const terminal = ensureTerminalInstance(terminalId);
        if (!terminal) return;
        if (terminal.cols < MIN_RESIZE_COLS || terminal.rows < MIN_RESIZE_ROWS) return;
        ws.sendMsg({
            type: 'system.resize',
            to: 'desktop',
            data: { terminalId, cols: terminal.cols, rows: terminal.rows }
        });
    }

    function mountTerminal(terminalId, container) {
        if (!terminalId || !container) return;
        terminalContainers.set(terminalId, container);
        const terminal = ensureTerminalInstance(terminalId);
        if (!terminal?.element) {
            terminal.open(container);
        }
        flushOutput(terminalId);
        if (terminalId === activeTerminalId.value) fitTerminal(terminalId);
    }

    async function fitTerminalNow(terminalId = activeTerminalId.value) {
        if (!terminalId) return;
        if (terminalId !== activeTerminalId.value) return;
        await nextTick();
        const container = terminalContainers.get(terminalId);
        if (!isContainerReady(container)) return;
        try {
            fitAddons.get(terminalId)?.fit();
        } catch {
            return;
        }
        sendResize(terminalId);
    }

    function fitTerminal(terminalId = activeTerminalId.value) {
        if (!terminalId) return;
        const previous = pendingFits.get(terminalId);
        if (previous) previous.forEach(clearTimeout);

        const timers = FIT_RETRY_DELAYS.map((delay) => setTimeout(() => {
            fitTerminalNow(terminalId);
            if (delay === FIT_RETRY_DELAYS[FIT_RETRY_DELAYS.length - 1]) {
                pendingFits.delete(terminalId);
            }
        }, delay));
        pendingFits.set(terminalId, timers);
    }

    function fitActiveTerminal() {
        fitTerminal(activeTerminalId.value);
    }

    function addRecentDir(dir) {
        const value = String(dir || '').trim();
        if (!value) return;
        const next = [value, ...recentDirs.value.filter((item) => item !== value)].slice(0, RECENT_DIRS_MAX);
        recentDirs.value = next;
        localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(next));
    }

    function requestTerminalList() {
        ws.sendMsg({ type: 'terminal.list', to: 'desktop', data: {} });
    }

    function createTerminal({ cwd, title } = {}) {
        const dir = String(cwd || '').trim();
        if (dir) addRecentDir(dir);
        ws.sendMsg({
            type: 'terminal.create',
            to: 'desktop',
            data: { cwd: dir || undefined, title }
        });
    }

    function activateTerminal(terminalId) {
        if (!terminalId || terminalId === activeTerminalId.value) return;
        activeTerminalId.value = terminalId;
        ws.sendMsg({ type: 'terminal.activate', to: 'desktop', data: { terminalId } });
        setTimeout(() => fitTerminal(terminalId), 30);
    }

    function closeTerminal(terminalId = activeTerminalId.value) {
        if (!terminalId) return;
        ws.sendMsg({ type: 'terminal.close', to: 'desktop', data: { terminalId } });
    }

    function ensureHandlers() {
        if (ready) return;
        ready = true;

        ws.onMessage('data.output', (msg) => {
            const terminalId = msg.data?.terminalId;
            if (!terminalId || !msg.data?.output) return;
            const terminal = terminalInstances.get(terminalId);
            if (terminal) terminal.write(msg.data.output);
            else queueOutput(terminalId, msg.data.output);
        });

        ws.onMessage('system.init', (msg) => {
            const terminalId = msg.data?.terminalId || activeTerminalId.value;
            if (!terminalId) return;
            const terminal = ensureTerminalInstance(terminalId);
            if (!terminal) return;
            if (msg.data?.cols && msg.data?.rows) {
                terminal.resize(msg.data.cols, msg.data.rows);
                if (terminalId === activeTerminalId.value) fitTerminal(terminalId);
            }
        });

        ws.onMessage('terminal.list', (msg) => {
            setTerminalTabs(msg.data?.terminals || [], msg.data?.activeTerminalId || '');
            setTimeout(fitActiveTerminal, 30);
        });

        ws.onMessage('terminal.created', (msg) => {
            const terminal = msg.data?.terminal;
            if (!terminal?.id) return;
            const next = [...terminalTabs.value.filter((item) => item.id !== terminal.id), terminal];
            setTerminalTabs(next, msg.data?.activeTerminalId || terminal.id);
            setTimeout(() => fitTerminal(terminal.id), 30);
        });

        ws.onMessage('terminal.closed', (msg) => {
            setTerminalTabs(
                terminalTabs.value.filter((item) => item.id !== msg.data?.terminalId),
                msg.data?.activeTerminalId || ''
            );
            setTimeout(fitActiveTerminal, 30);
        });

        ws.onMessage('terminal.activated', (msg) => {
            if (!msg.data?.terminalId) return;
            activeTerminalId.value = msg.data.terminalId;
            setTimeout(() => fitTerminal(msg.data.terminalId), 30);
        });

        ws.onMessage('terminal.error', (msg) => {
            if (msg.data?.error) toast.show(msg.data.error, 2400);
        });

        // 设备(重新)上线时,拉一次终端列表。在线状态由 ws store 维护。
        watch(() => ws.deviceOnline, (online, was) => {
            if (online && !was) {
                requestTerminalList();
                setTimeout(fitActiveTerminal, 80);
            }
        });

        watch(fontSize, (v) => {
            localStorage.setItem(FONT_KEY, String(v));
            for (const [terminalId, terminal] of terminalInstances.entries()) {
                terminal.options.fontSize = v;
                setTimeout(() => fitTerminal(terminalId), 30);
            }
        });

        // 主题切换时，所有终端配色实时跟随 晴空/谧夜
        window.addEventListener('one-theme', () => {
            const th = pickTermTheme();
            for (const terminal of terminalInstances.values()) terminal.options.theme = th;
        });
    }

    function initialize() {
        ensureHandlers();
        requestTerminalList();
    }

    function sendKey(code) { sendInputRaw(code); }

    function restartPty() {
        if (!activeTerminalId.value) return;
        ws.sendMsg({ type: 'system.command', to: 'desktop', data: { command: 'restart', terminalId: activeTerminalId.value } });
        toast.show('已发送重启指令');
    }

    function clearTerminal() {
        const terminal = terminalInstances.get(activeTerminalId.value);
        terminal?.clear();
        toast.show('已清屏');
    }

    function resetTerminal() {
        const terminal = terminalInstances.get(activeTerminalId.value);
        terminal?.reset();
        toast.show('已重置视图');
    }

    function forceInterrupt() {
        sendInputRaw('\x03\x03\x03');
        toast.show('已发送 Ctrl+C × 3');
    }

    function setTab(t) {
        activeTab.value = t;
        localStorage.setItem(PANEL_TAB_KEY, t);
    }

    function togglePanel() {
        showPanel.value = !showPanel.value;
        setTimeout(fitActiveTerminal, 60);
    }

    function increaseFontSize() { if (fontSize.value < 24) fontSize.value += 1; }
    function decreaseFontSize() { if (fontSize.value > 10) fontSize.value -= 1; }

    function sendInput() {
        const val = inputText.value;
        if (!val) return;
        sendInputRaw(val + '\r');
        const last = history.value[history.value.length - 1];
        if (val !== last) {
            history.value.push(val);
            if (history.value.length > HISTORY_MAX) history.value.shift();
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value));
        }
        historyIdx = history.value.length;
        historyDraft = '';
        inputText.value = '';
    }

    function historyUp() {
        if (history.value.length === 0) return;
        if (historyIdx === history.value.length) historyDraft = inputText.value;
        historyIdx = Math.max(0, historyIdx - 1);
        inputText.value = history.value[historyIdx] || '';
    }

    function historyDown() {
        if (historyIdx >= history.value.length) {
            inputText.value = historyDraft;
            return;
        }
        historyIdx++;
        inputText.value = historyIdx === history.value.length
            ? historyDraft
            : (history.value[historyIdx] || '');
    }

    async function pasteClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) { sendInputRaw(text); toast.show('已粘贴'); }
        } catch { toast.show('无法读取剪贴板'); }
    }

    return {
        fontSize, activeTab, showPanel, inputText, history,
        terminalTabs, activeTerminalId, recentDirs,
        initialize, terminalTitle, activeTerminal,
        mountTerminal, fitTerminal, fitActiveTerminal,
        requestTerminalList, createTerminal, activateTerminal, closeTerminal, addRecentDir,
        sendInputRaw, sendKey, sendInput,
        historyUp, historyDown,
        restartPty, clearTerminal, resetTerminal, forceInterrupt,
        setTab, togglePanel,
        increaseFontSize, decreaseFontSize,
        pasteClipboard,
    };
});
