---
"@weapp-vite/miniprogram-automator": patch
---

fix(miniprogram-automator): 修复 RC 与 SDK 3.17.5 的组件方法接收者错绑

为已实测的 RC 2.02.2609231 与基础库 3.17.5 组合启用现有 Exparser caller 桥接，避免将组件 resolver 的对象编号交给另一 Runtime 对象表。保留单次业务调用、真实后端选择与监听清理，不扩展到未经验证的版本组合。
