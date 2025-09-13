# Terminal

通过浏览器远程访问本地终端。

![截图](https://r2.chatnext.ai/cc-link-release/screen.png)

## 使用方法

### 1. 部署Worker服务

```bash
cd worker
npm install -g wrangler
wrangler deploy
```

部署后获得Worker地址，格式如：`https://terminal.your-subdomain.workers.dev`

### 2. 修改客户端配置

根据部署后的域名，修改配置文件中的服务器地址：

**修改** `desktop/nodejs/config.js`:
```js
module.exports = {
    serverUrl: 'wss://your-worker-domain.com',
    webUrl: 'https://your-worker-domain.com'
};
```

### 3. 启动桌面客户端

```bash
cd desktop/nodejs
npm install
npm start
```

程序会输出网页链接，在任何设备浏览器中打开即可使用。

## 系统要求

- Node.js 14+
- 支持 macOS/Linux/Windows