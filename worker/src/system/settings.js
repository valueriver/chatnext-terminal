// 设置:settings 表上的 KV。pass_hash(访问口令)+ 模型配置(含 apiKey)都在这里。
// identity 用它读口令、agent 用它读模型配置 —— KV 单一真相。
const DEFAULTS = {
    apiUrl: '',
    apiKey: '',
    model: '',
    system: '',
    contextTurns: '100',
    compressThreshold: '12000',
    toolResultMaxChars: '12000',
    compactPrompt: '',
};

export function settings(db) {
    return {
        async get(key, fallback = '') {
            const row = await db.first('SELECT value FROM settings WHERE key = ?', String(key));
            return row ? row.value : fallback;
        },
        async set(key, value) {
            await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', String(key), String(value ?? ''));
        },
        async all() {
            const rows = await db.all('SELECT key, value FROM settings');
            return { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
        },
    };
}

export { DEFAULTS };
