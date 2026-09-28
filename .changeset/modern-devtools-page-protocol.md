---
"@weapp-vite/miniprogram-automator": patch
---

兼容微信开发者工具 2.02.2609231 的 Page 帧协议异常，仅通过已有 AppService 页面方法协议调用真实页面实例，避免方法存在却调用失败，同时保留原生元素查询和组件作用域。
