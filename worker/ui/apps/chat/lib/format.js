import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

const TOOL_LABELS = {
    shell: '终端命令',
    open_app: '打开应用',
    browser_status: '浏览器状态',
    browser_open: '打开网页',
    browser_navigate: '页面导航',
    browser_tabs: '浏览器标签',
    browser_activate_tab: '切换标签',
    browser_read: '读取网页',
    browser_eval: '执行网页 JS',
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
    return args.summary || args.command || args.url || args.script || args.text || args.name || '';
}

function renderMd(value) {
    return marked.parse(String(value || ''));
}

function fmtArgs(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
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

export { fmtArgs, fmtTime, renderMd, toolLabel, toolSubtitle };
