---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复状态保持 HMR 在开发构建启动前未切换 Rolldown ESM 输出格式，导致部分模板的开发服务无法启动的问题。
