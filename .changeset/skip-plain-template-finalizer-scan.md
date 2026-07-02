---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化输出 finalizer 的模板资源处理，普通 WXML/AXML 资源在不包含事件、注释、脚本模块、模板 import 或跨平台指令等归一化标记时跳过 WXML parser，减少 build/HMR 生成阶段对无关模板的重复解析。
