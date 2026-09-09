---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复通过 TypeScript loader 启动源码 CLI 时，状态保持 HMR 引擎与 Vite 原生插件加载为不同模块实例的问题。统一使用 ESM 加载 Vite 配套的 Rolldown，确保 TypeScript 等原生转换在后置分析前执行，避免解析失败并保留原有异步依赖分析语义。
