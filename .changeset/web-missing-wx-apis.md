---
"@weapp-vite/web": patch
---

fix(web): 补齐 hideToast、hideShareMenu、hideHomeButton、onError 等高频 wx API，避免调用即抛 TypeError 打断页面初始化。
