// Roam 设备配置。复制为 config.js 填写。设备 = worker 的一只手。
export default {
    // worker 地址(本地 dev 用 http://localhost:9506)
    WORKER_URL: 'https://roam.yanglong.yun',
    // 设备 id:留空用主机名(同机重启稳定)
    DEVICE_ID: '',
    // 设备注册密钥:首次注册即设定,之后须一致(防别的机器冒用此 id)
    DEVICE_SECRET: '',
    // 显示名:留空用主机名
    DEVICE_NAME: '',
    // 本地 CDP 桥端口(给 browser-use 扩展连)
    BROWSER_BRIDGE_PORT: '9510',
};
