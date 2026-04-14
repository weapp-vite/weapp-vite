---
"@weapp-vite/vscode": patch
---

修复 VS Code 插件发布临时 manifest 仍携带 `devDependencies`、`scripts` 和 `private` 字段的问题，避免 `vsce` 在发布阶段错误地拿开发依赖参与引擎版本校验，导致 Marketplace 自动发布失败。
