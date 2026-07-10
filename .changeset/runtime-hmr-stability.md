---
"weapp-vite": minor
"create-weapp-vite": minor
---

修复多类开发态增量更新稳定性问题，包括根入口脚本未重新写出、带点号入口被误识别、Vue JSON 宏与外部样式复用旧缓存、auto-routes 配置未刷新、共享 WXML/WXS 与 SCSS 原子保存漏更新、Tailwind 内容刷新复用旧 JIT 输出，以及支付宝原生样式依赖更新范围不完整。相关场景现在会在保持局部 HMR 的同时正确刷新配置、脚本、模板和样式产物。
