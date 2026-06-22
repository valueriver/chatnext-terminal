// 工具定义(schema:长什么样)。定义在云,执行分流见 functions.js。
// 设备工具与设备端 server 的 functions.js 同名 —— 大脑发请求,设备出手;均带 device 路由参数。
// device:设备 id(从设备列表选;省略则用当前在线设备)。
// summary:每个工具必填的一句话摘要,前端显示在工具消息上方。
const SUMMARY = { type: 'string', description: '本次操作的一句话摘要,面向用户展示。' };

export const tools = [
    // ───────── 云端原生(碰 D1,无需设备) ─────────
    {
        type: 'function',
        function: {
            name: 'sql',
            description: [
                '在云端 D1 上执行任意 SQL(全权:SELECT/INSERT/UPDATE/DELETE/CREATE/ALTER/PRAGMA…)。这是你自己的库,随意读写。',
                '表:notes / tasks / task_runs / chats / messages / compactions / shortcuts / settings。',
                '查表结构:SELECT sql FROM sqlite_master WHERE name=\'表名\'。',
            ].join('\n'),
            parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: '一条 SQL 语句' }, summary: SUMMARY },
                required: ['query', 'summary'],
            },
        },
    },

    // ───────── shell ─────────
    {
        type: 'function',
        function: {
            name: 'shell',
            description: '在设备上执行 shell 命令并返回输出(stdout+stderr)。用于查看/操作文件、运行程序、查询系统状态等。',
            parameters: {
                type: 'object',
                properties: {                    command: { type: 'string', description: '要执行的 shell 命令。' },
                    summary: SUMMARY,
                    cwd: { type: 'string', description: '可选工作目录,默认用户主目录。' },
                    timeout: { type: 'number', description: '超时秒数,默认 30,范围 [1,300]。' },
                },
                required: ['command', 'summary'],
            },
        },
    },

    // ───────── 浏览器:唯一工具,直发 CDP(经 browser-use 扩展驱动设备的 Chrome) ─────────
    {
        type: 'function',
        function: {
            name: 'browser_cdp',
            description: [
                '通过 Chrome DevTools Protocol 操作设备的 Chrome(经 browser-use 扩展)。这是唯一的浏览器工具:你直接发原始 CDP 方法,默认作用于当前活动标签页。',
                '常用:',
                '· Page.navigate {url} — 打开/跳转网址;',
                '· Runtime.evaluate {expression, returnByValue:true, awaitPromise:true} — 跑 JS:读/改 DOM、点击元素、填表单、抓数据(绝大多数网页操作用它最省事);',
                '· Input.dispatchMouseEvent / Input.dispatchKeyEvent — 模拟鼠标键盘;',
                '· Page.captureScreenshot {format:"jpeg"} — 截图(返回 base64);',
                '· DOM.* / Network.* 等其余 CDP 域按需使用。',
                '需 Chrome 已安装并连上 browser-use 扩展;未连接会返回明确错误。',
            ].join('\n'),
            parameters: {
                type: 'object',
                properties: {                    method: { type: 'string', description: 'CDP 方法名,如 "Page.navigate"、"Runtime.evaluate"、"Input.dispatchMouseEvent"。' },
                    params: { type: 'object', description: '该 CDP 方法的参数对象。' },
                    tabId: { type: 'number', description: '可选,目标标签的 tabId;默认当前活动标签。' },
                    summary: SUMMARY,
                },
                required: ['method', 'summary'],
            },
        },
    },

    // ───────── 电脑(键鼠 / 截图) ─────────
    {
        type: 'function',
        function: {
            name: 'computer_status',
            description: '查看设备电脑控制可用性:平台、驱动(screencapture/osascript/cliclick)是否就绪、逻辑屏幕尺寸、当前前台应用。点击前建议先查屏幕尺寸。',
            parameters: { type: 'object', properties: { summary: SUMMARY }, required: ['summary'] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_screenshot',
            description: '截取设备整个屏幕并推送到对话界面给用户查看,返回尺寸等元信息(不返回图像数据本身)。',
            parameters: { type: 'object', properties: { summary: SUMMARY }, required: ['summary'] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'open_app',
            description: '在设备打开/切换到一个应用(macOS:open -a)。',
            parameters: {
                type: 'object',
                properties: { name: { type: 'string', description: '应用名,如 "Safari"、"备忘录"' }, summary: SUMMARY },
                required: ['name', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_type',
            description: '在设备当前前台应用输入一段文本(keystroke)。',
            parameters: {
                type: 'object',
                properties: { text: { type: 'string' }, summary: SUMMARY },
                required: ['text', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_key',
            description: '在设备按一个键,可带修饰键。例如 {key:"c",modifiers:["command"]} = ⌘C;{key:"enter"} = 回车。',
            parameters: {
                type: 'object',
                properties: {                    key: { type: 'string', description: '单个字符或命名键:enter/tab/space/escape/delete/up/down/left/right/home/end/page_up/page_down/f1..f12' },
                    modifiers: { type: 'array', items: { type: 'string' }, description: 'command/control/option/shift 的任意组合' },
                    summary: SUMMARY,
                },
                required: ['key', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_click',
            description: '在设备鼠标点击(需 cliclick)。给 x,y 则移动到该逻辑坐标后点击;不给则在当前位置点击。',
            parameters: {
                type: 'object',
                properties: {                    x: { type: 'number' }, y: { type: 'number' },
                    button: { type: 'string', enum: ['left', 'right'], description: '默认 left' },
                    clicks: { type: 'number', description: '点击次数,默认 1;2 为双击' },
                    summary: SUMMARY,
                },
                required: ['summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_move',
            description: '把设备鼠标移动到指定逻辑坐标(需 cliclick)。',
            parameters: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, summary: SUMMARY },
                required: ['x', 'y', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_scroll',
            description: '在设备当前位置滚动(需 cliclick)。',
            parameters: {
                type: 'object',
                properties: {                    direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: '默认 down' },
                    amount: { type: 'number', description: '滚动量,默认 3' },
                    summary: SUMMARY,
                },
                required: ['summary'],
            },
        },
    },
];
