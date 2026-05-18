---
"@weapp-vite/vscode": patch
---

增强 VS Code 扩展在 monorepo 中的包管理器识别，支持通过根目录 `packageManager` 字段或 `pnpm-lock.yaml`、`yarn.lock`、`package-lock.json` 推断 npm、yarn 与 pnpm 的任务执行命令。
