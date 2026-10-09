---
"@weapp-vite/miniprogram-automator": patch
---

修复微信开发者工具 Nightly 2.02.2610082/2.02.2610092 的页面方法调用兼容性，使用已有 AppService 调用路径正确访问页面实例并等待异步结果，同时保留原生元素查询与组件作用域。
