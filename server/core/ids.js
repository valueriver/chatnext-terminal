function generateSessionId() {
    return Math.random().toString(36).slice(2, 8);
}

function generateTerminalId() {
    return 'term-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export { generateSessionId, generateTerminalId };
export default { generateSessionId, generateTerminalId };
