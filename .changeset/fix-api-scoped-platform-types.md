---
"@weapp-core/api": patch
"@weapp-core/types": patch
"@wevu/api": patch
"wevu": patch
"@weapp-vite/i18n": patch
---

fix(types): 由共享类型包提供模块内的完整官方小程序声明，在消费者显式加载官方声明时保留原生类型身份，修复 API、运行时及 i18n 在独立 Node、DOM 与 Vitest 消费者中的全局冲突和类型入口缺失。
