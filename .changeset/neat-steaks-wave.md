---
"weapp-vite": patch
"@weapp-core/init": patch
"create-weapp-vite": patch
---

迁移 TypeScript 6 相关的 tsconfig 默认配置与受管生成逻辑。初始化模板和 `.weapp-vite/tsconfig.app.json` 不再生成已弃用的 `baseUrl` 与冗余的 `DOM.Iterable`，同时把别名路径统一改成对当前文件位置生效的显式相对路径，避免 `vue-tsc` / `tsc` 在 TypeScript 6 下因旧配置报错。
