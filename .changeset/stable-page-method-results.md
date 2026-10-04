---
"@weapp-vite/miniprogram-automator": patch
---

修复微信开发者工具 Stable 2.02.2608080 调用异步页面方法时返回空对象的问题，沿用已验证的 AppService 方法调用兼容路径，等待真实异步返回值，同时保持原生元素查询的组件作用域。
