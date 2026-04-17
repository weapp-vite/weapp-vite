---
'@weapp-vite/vscode': patch
---

修复 VS Code 扩展在独立检查环境下缺少 `@weapp-vite/ast` 依赖导致模板增强测试无法解析 AST 模块的问题，并补齐跨平台 URI mock 的测试覆盖。
