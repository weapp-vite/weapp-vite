---
"@weapp-vite/vscode": patch
---

修复 VS Code 扩展对 `package.json` 的 weapp-vite 常用脚本诊断误报。现在只有当当前目录同时具备 weapp-vite 的包级信号，并且能结合 `vite.config.*` 或 `app.json` 确认为真实 weapp-vite 项目时，才会提示补齐 `dev/build/generate/open` 等常用脚本，避免 monorepo 中普通包或工具包被无差别提示。
