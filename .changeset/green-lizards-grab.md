---
"weapp-vite": patch
"create-weapp-vite": patch
---

补齐 `vite.config.*` 与 `weapp-vite.config.*` 双配置入口在工程体验上的一致性。现在托管的 `.weapp-vite/tsconfig.node.json`、示例项目 `tsconfig`、配置加载提示与相关 benchmark 脚本都会同时识别这两类文件；当项目中同时存在两套配置时，CLI 会明确提示当前已合并 `weapp` 配置，并说明 `weapp-vite.config.*` 的优先级高于 `vite.config.*`。同时同步更新手动接入、目录结构、自动路由、分包、插件、npm 等文档入口，避免用户继续误以为只能使用 `vite.config.ts`。
