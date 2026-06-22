import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

// 与 worker/src/do/agent/tools.js 的工具集对齐。
const TOOL_LABELS = {
    sql: '数据库',
    shell: '终端命令',
    browser_cdp: '浏览器',
    open_app: '打开应用',
    computer_status: '电脑状态',
    computer_screenshot: '屏幕截图',
    computer_type: '键盘输入',
    computer_key: '按键',
    computer_click: '鼠标点击',
    computer_move: '移动鼠标',
    computer_scroll: '滚动',
};

function toolLabel(name) {
    return TOOL_LABELS[name] || name;
}

function toolSubtitle(row) {
    const args = row.args || {};
    // summary 是大部分设备工具的面向用户摘要;其余工具退回各自的关键参数。
    return args.summary || args.command || args.query || args.method || args.url || args.text || args.name || '';
}

function renderMd(value) {
    return marked.parse(String(value || ''));
}

function fmtArgs(value) {
    // summary 已在外层标题展示,展开的「输入」里去掉它,只留真正的参数。
    const { summary, ...rest } = value && typeof value === 'object' ? value : {};
    try {
        return JSON.stringify(rest, null, 2);
    } catch {
        return String(value);
    }
}

// 「输出」:结果常是 JSON.stringify 出来压成一行的对象,能解析就缩进展示,否则原样。
function fmtResult(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'object') {
        try { return JSON.stringify(value, null, 2); } catch { return String(value); }
    }
    const str = String(value);
    try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}

function fmtTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const diff = Date.now() - value;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

export { fmtArgs, fmtResult, fmtTime, renderMd, toolLabel, toolSubtitle };
