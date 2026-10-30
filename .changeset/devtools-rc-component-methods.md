---
"@weapp-vite/miniprogram-automator": patch
---

fix(automator): 修复部分 RC 开发者工具中的组件方法调用错绑。

为 RC `2.02.2609231` 搭配基础库 `3.17.5` 或 `3.17.6` 的组合启用精确兼容处理，修复 Exparser 组件方法调用到错误对象的问题。

每次操作只调用一次业务方法；其他 IDE 与基础库版本组合继续使用原生协议。
