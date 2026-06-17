// local transport：没配 CLOUDFLARE_WORKER_URL 时，server 自己起 WS server + 挂 ui/dist，
// 浏览器直连本机，不经 Worker。下一轮实现完整（含本地访问控制）。
export function createLocal() {
    throw new Error('local transport 尚未实现；当前请在 config.js 配置 CLOUDFLARE_WORKER_URL 走 relay 模式');
}
