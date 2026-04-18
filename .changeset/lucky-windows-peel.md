---
'@weapp-vite/vscode': patch
---

调整 VS Code 扩展对 `package.json` 常用脚本建议的呈现方式：不再把“建议补齐常用 weapp-vite 脚本”作为 Problems 诊断展示，避免在问题面板里产生噪音；相关补齐能力仍保留为按需触发的 Quick Fix，并且只会在确认缺少常用脚本时出现。
