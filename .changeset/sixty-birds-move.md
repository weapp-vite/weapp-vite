---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序构建中动态导入预加载辅助代码导致的 `__VITE_IS_MODERN__ is not defined` 问题。现在在小程序配置合并阶段默认关闭 `build.modulePreload`，避免注入不适用于小程序运行时的预加载逻辑；若用户显式配置 `build.modulePreload`，仍保持用户配置优先。
