---
'@weapp-vite/miniprogram-automator': patch
---

修复新版微信开发者工具 `/auto` 返回不透明 token 时被误判为失败的问题：成功响应使用请求的自动化端口建立连接，保留旧版响应兼容，并避免错误信息泄露响应 token。
