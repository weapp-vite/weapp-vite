---
'@weapp-vite/miniprogram-automator': patch
---

针对微信开发者工具 2.01.2510290 的 Page frame 协议无响应问题，自动选择 App-service Page 协议，避免元素查询、数据读写和页面方法调用等待协议超时后才降级。
