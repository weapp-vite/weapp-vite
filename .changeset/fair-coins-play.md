---
"@weapp-vite/vscode": patch
---

改进 VS Code 扩展的 weapp-vite 项目体验：修复 `package.json` 常用脚本诊断误报，只在能确认当前目录确实是 weapp-vite 项目时才提示补齐脚本；同时把 `Generate` 改为扩展内置的页面 / 组件 `.vue` 骨架生成能力，不再依赖 `wv` CLI，支持读取 `vite.config.*` 中常见的 `weapp.generate.dirs` / `filenames` 配置，并新增资源管理器目录右键创建页面 / 组件入口，以及页面生成后直接加入 `app.json`、批量同步未注册页面到 `app.json` 的交互。
