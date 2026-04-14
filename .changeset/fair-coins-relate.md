---
"@weapp-vite/vscode": patch
---

修复 VS Code 插件发布计划仅比较上一个提交版本的问题，改为直接比较仓库当前版本与 Marketplace 线上版本。这样当某次首次发布失败后，只要线上版本仍然落后，后续成功的 release workflow 仍会自动补发对应版本。
