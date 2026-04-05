---
'@weapp-vite/miniprogram-automator': patch
'weapp-ide-cli': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复小程序截图链路在微信开发者工具无响应或自动化会话异常时的诊断行为，并为 `weapp-vite screenshot` / `wv screenshot` / `weapp-ide-cli screenshot` 新增 `--full-page` 整页长截图能力。现在截图命令会正确等待异步命令完成；当 DevTools websocket 连接失败、截图请求长时间不返回，或清理会话时 `App.exit` / `Tool.close` 无响应时，会显式抛出可排查的错误提示，而不再静默退出或表现为“成功但没有产物”；同时 `--page pages/...` 这类常见写法也会自动归一化为小程序路由所需的前导 `/`。
