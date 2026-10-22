---
"@weapp-vite/miniprogram-automator": patch
---

fix(miniprogram-automator): 修复微信开发者工具 Stable 2.02.2608080 配合基础库 3.17.5 调用自定义组件方法时的上下文错绑，精确解析真实组件实例并只派发一次业务调用，保留原返回值与异常语义。
