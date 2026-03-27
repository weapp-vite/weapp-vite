---
"create-weapp-vite": patch
---

修复 `create-weapp-vite` 在新工作区或发布打包流程中可能跳过模板同步的问题，避免 `npm create weapp-vite@latest` 生成项目时只落下 `package.json` 而缺失完整模板文件。
