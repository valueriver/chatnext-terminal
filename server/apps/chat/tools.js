// 工具定义（OpenAI function-calling 格式）。名称需与 functions.js 的导出对应。
// 分三类：shell / 浏览器(Chrome) / 电脑(键鼠截图)。均仅 macOS；鼠标滚动需 cliclick。
const tools = [
    {
        type: 'function',
        function: {
            name: 'shell',
            description: '在用户本机执行 shell 命令并返回输出（stdout+stderr）。用于查看/操作文件、运行程序、查询系统状态等。',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: '要执行的 shell 命令。' },
                    summary: { type: 'string', description: '本次命令的一句话摘要，面向用户展示。' },
                    cwd: { type: 'string', description: '可选工作目录，默认用户主目录。' },
                    timeout: { type: 'number', description: '超时秒数，默认 30，范围 [1,300]。' },
                },
                required: ['command', 'summary'],
            },
        },
    },

    // ───────── 浏览器（Google Chrome，经 AppleScript） ─────────
    {
        type: 'function',
        function: {
            name: 'browser_status',
            description: '查看 Chrome 是否运行、标签数量、当前活动标签的标题与网址。',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'browser_open',
            description: '在 Chrome 新标签页打开一个网址（会自动补 https://）。',
            parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'browser_navigate',
            description: '把 Chrome 当前活动标签导航到指定网址。',
            parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'browser_tabs',
            description: '列出 Chrome 所有窗口与标签（含 window/tab 序号、是否活动、标题、网址）。',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'browser_activate_tab',
            description: '切换到指定窗口/标签（序号来自 browser_tabs）。',
            parameters: {
                type: 'object',
                properties: { window: { type: 'number', description: '窗口序号，默认 1' }, tab: { type: 'number', description: '标签序号' } },
                required: ['tab'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'browser_read',
            description: '读取 Chrome 当前活动标签的可见正文文本（document.body.innerText），用于理解页面内容。',
            parameters: { type: 'object', properties: { maxChars: { type: 'number', description: '最多返回字符数，默认 8000' } } },
        },
    },
    {
        type: 'function',
        function: {
            name: 'browser_eval',
            description: '在 Chrome 当前活动标签执行 JavaScript 并返回结果（字符串）。可用于点击元素、填表单、抓取数据等精确网页操作。需 Chrome 开启「允许 Apple 事件中的 JavaScript」。',
            parameters: { type: 'object', properties: { script: { type: 'string', description: 'JavaScript 代码，返回值会转成字符串回传。' } }, required: ['script'] },
        },
    },

    // ───────── 电脑（键鼠 / 截图） ─────────
    {
        type: 'function',
        function: {
            name: 'computer_status',
            description: '查看电脑控制可用性：平台、驱动(screencapture/osascript/cliclick)是否就绪、逻辑屏幕尺寸、当前前台应用。点击前建议先查屏幕尺寸。',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_screenshot',
            description: '截取整个屏幕并推送到对话界面给用户查看，返回尺寸等元信息（不返回图像数据本身）。',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'open_app',
            description: '打开/切换到一个本机应用（macOS：open -a）。',
            parameters: { type: 'object', properties: { name: { type: 'string', description: '应用名，如 "Safari"、"备忘录"' } }, required: ['name'] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_type',
            description: '在当前前台应用输入一段文本（keystroke）。',
            parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_key',
            description: '按一个键，可带修饰键。例如 {key:"c",modifiers:["command"]} = ⌘C；{key:"enter"} = 回车。',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: '单个字符或命名键：enter/tab/space/escape/delete/up/down/left/right/home/end/page_up/page_down/f1..f12' },
                    modifiers: { type: 'array', items: { type: 'string' }, description: 'command/control/option/shift 的任意组合' },
                },
                required: ['key'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_click',
            description: '鼠标点击（需 cliclick）。给 x,y 则移动到该逻辑坐标后点击；不给则在当前位置点击。',
            parameters: {
                type: 'object',
                properties: {
                    x: { type: 'number' }, y: { type: 'number' },
                    button: { type: 'string', enum: ['left', 'right'], description: '默认 left' },
                    clicks: { type: 'number', description: '点击次数，默认 1；2 为双击' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_move',
            description: '把鼠标移动到指定逻辑坐标（需 cliclick）。',
            parameters: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_scroll',
            description: '在当前位置滚动（需 cliclick）。',
            parameters: {
                type: 'object',
                properties: {
                    direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: '默认 down' },
                    amount: { type: 'number', description: '滚动量，默认 3' },
                },
            },
        },
    },
];

export { tools };
