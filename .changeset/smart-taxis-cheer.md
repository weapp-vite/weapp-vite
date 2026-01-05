---
"weapp-vite": patch
"@weapp-core/init": major
"create-weapp-vite": minor
---

## 变更说明

- `weapp-vite` CLI 移除 `create` 命令；新项目创建请使用 `create-weapp-vite`（例如 `pnpm create weapp-vite`）。
- `@weapp-core/init` 仅保留“初始化配置文件”相关能力（如 `initConfig`），不再包含模板项目创建能力。
- 模板同步与模板创建逻辑迁移到 `create-weapp-vite`，并对外导出 `createProject` / `TemplateName`。

