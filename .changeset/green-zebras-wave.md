---
"@wevu/web-apis": patch
"create-weapp-vite": patch
"weapp-vite": patch
---

修复小程序运行时中 `socket.io-client` 的 `polling` 与 `websocket` 两种传输模式兼容性。现在构建产物会提前把请求相关全局对象的惰性占位符暴露到 `globalThis`，并在真实运行时安装阶段正确替换这些占位符，避免第三方库在模块初始化阶段读取 `WebSocket` 等全局对象时失效或形成递归调用。
