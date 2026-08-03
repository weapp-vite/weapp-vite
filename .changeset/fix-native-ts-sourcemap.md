---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `wv build --sourcemap` 未透传到 Vite 构建配置，以及分包 npm 本地化重写后原生 TypeScript 页面 sourcemap 继续沿用旧映射导致行号错乱的问题。
