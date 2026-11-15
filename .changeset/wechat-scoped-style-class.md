---
"weapp-vite": patch
---

fix(weapp-vite): 修复微信小程序组件的 scoped 样式失效

构建微信小程序时，模板和 WXSS 使用同一个作用域 class，避免生成微信组件不支持的属性选择器。
