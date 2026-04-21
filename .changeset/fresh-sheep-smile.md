---
"create-weapp-vite": patch
---

为所有内置模板与脚手架生成流程补齐 `@types/node`，修复新建项目中 `.weapp-vite/tsconfig.node.json` / `.weapp-vite/tsconfig.server.json` 引用 Node 类型时报“找不到类型定义文件 `node`”的问题，并增加相关回归测试。
