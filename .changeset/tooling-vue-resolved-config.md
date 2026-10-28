---
"weapp-vite": patch
"@mpcore/simulator": patch
---

fix(tooling): 修复诊断脚本的严格类型契约，并让 simulator 浏览器验证使用显式 TypeScript 配置，避免未准备的其他应用配置干扰 Vue 转换。
