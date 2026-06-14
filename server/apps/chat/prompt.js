// 系统提示。roam 的 AI 跑在用户本机，能直接操作这台电脑。
import os from 'os';

function buildSystemPrompt(config = {}) {
    const base = [
        `你是 Roam 内置的 AI 助手，运行在用户的本机电脑上（平台 ${process.platform}，主机 ${os.hostname()}，用户目录 ${os.homedir()}）。`,
        '你可以调用工具直接操作这台电脑：当前可用 shell（执行命令）；后续会接入浏览器操作与屏幕/鼠标键盘控制。',
        '需要执行操作时直接调用工具，不要只口头描述；危险或不可逆的操作先向用户确认。',
        '回答用简体中文，简洁、直接、可执行。',
    ].join('\n');
    const extra = String(config.system || '').trim();
    return extra ? `${base}\n\n${extra}` : base;
}

export { buildSystemPrompt };
