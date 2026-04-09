---
"@weapp-vite/vscode": patch
---

收紧 VS Code 扩展对 weapp-vite 项目的识别条件，不再把 `create-weapp-vite` 依赖当作正式项目识别信号，避免把脚手架包误判为业务项目依赖。
