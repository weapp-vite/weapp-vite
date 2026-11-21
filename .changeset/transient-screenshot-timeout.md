---
'@weapp-vite/miniprogram-automator': patch
---

fix(miniprogram-automator): 在 IDE 重建期间重试截图响应超时。

微信开发者工具前端重建时，截图请求可能以 automator response timeout 结束，但连接仍可继续使用。现在将该瞬时错误纳入截图重试，避免 DOM 验收因截图超时中断。
