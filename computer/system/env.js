// 设备配置加载:config.js(default export) 覆盖默认,缺省回退主机名。
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(serverRoot, 'config.js');

let cfg = {};
if (fs.existsSync(configPath)) {
    try {
        const loaded = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
        cfg = loaded.default || loaded || {};
    } catch (e) {
        console.error(`配置文件加载失败: ${configPath}\n${e.message}`);
        process.exit(1);
    }
}

const pick = (k, fallback = '') => (process.env[k] ?? cfg[k] ?? fallback);

export const WORKER_URL = String(pick('WORKER_URL', '')).trim().replace(/\/+$/, '');
export const DEVICE_ID = String(pick('DEVICE_ID', '') || os.hostname()).trim();
export const DEVICE_SECRET = String(pick('DEVICE_SECRET', '')).trim();
export const DEVICE_NAME = String(pick('DEVICE_NAME', '') || os.hostname()).trim();
export const BROWSER_BRIDGE_PORT = String(pick('BROWSER_BRIDGE_PORT', '9510')).trim();

// 这台设备声明的能力(供云端设备清单/选择)
export const CAPABILITIES = ['shell', 'terminal', 'files', 'screen', 'status', 'browser']
    .concat(process.platform === 'darwin' ? ['computer'] : []);

if (!WORKER_URL) { console.error('❌ 未配置 WORKER_URL(config.js)'); process.exit(1); }
