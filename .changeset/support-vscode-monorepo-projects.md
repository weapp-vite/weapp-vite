---
"@weapp-vite/vscode": patch
---

修复 VS Code 扩展在 monorepo 根目录打开时无法把任务命令定位到实际 weapp-vite 子项目的问题，命令会优先使用当前文件所在项目，并在多个子项目可选时提示选择目标项目。
