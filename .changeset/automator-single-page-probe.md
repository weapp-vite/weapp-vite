---
"@weapp-vite/miniprogram-automator": patch
---

允许页面就绪探针显式关闭页面栈回退，配合单次尝试与协议超时，避免冷启动期间的页面元数据暂缺触发额外请求并超出调用方的就绪预算。
