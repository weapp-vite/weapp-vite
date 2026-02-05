---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

lib 模式默认生成 dts，支持 .vue/wevu SFC，并修复 rolldown dts 输出命名冲突；同时导出 WevuComponentConstructor 以保障 vue-tsc 生成声明。
