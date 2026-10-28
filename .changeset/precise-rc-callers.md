---
"@weapp-vite/miniprogram-automator": patch
---

fix(automator): 修复 RC 2.02.2609231 与基础库 3.17.6 组合的 Exparser 组件方法接收者错绑，复用现有精确 caller 桥接。按 IDE 与基础库的精确组合启用兼容路径，保留单次业务派发及监听清理，其他未验证组合继续使用原生协议。
