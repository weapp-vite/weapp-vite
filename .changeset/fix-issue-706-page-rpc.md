---
"@weapp-vite/miniprogram-automator": patch
---

修复微信开发者工具新版自动化连接中 `Page.*` 域 RPC 超时后页面查询和数据读取会长期卡住的问题。页面元素查询、数据读取、`setData` 和页面方法调用会在可恢复的 Page 协议异常后降级到 App-Service route 查询，避免 `page.$$`、`page.$`、`page.data()` 探针硬超时。
