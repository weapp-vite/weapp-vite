---
"@weapp-vite/vscode": patch
---

改进 VS Code 扩展的 weapp-vite 项目体验：修复 `package.json` 常用脚本诊断误报，只在能确认当前目录确实是 weapp-vite 项目时才提示补齐脚本；同时把 `Generate` 改为扩展内置的页面 / 组件 `.vue` 骨架生成能力，不再依赖 `wv` CLI，支持读取 `vite.config.*` 中常见的 `weapp.generate.dirs` / `filenames` 配置，并新增资源管理器目录右键创建页面 / 组件入口，以及页面生成后直接加入 `app.json`、批量同步未注册页面到 `app.json`、批量补齐 `app.json` 已声明但文件缺失页面的交互；当已声明页面文件在资源管理器中被重命名、移动或删除时，扩展也会自动同步更新 `app.json` 中的页面路由，并在 route 已无其他候选页面文件时自动清理失效声明；此外，扩展现在也会识别 `.vue` 文件 `<json>` 里的 `usingComponents` 本地组件路径，为缺失组件给出诊断、悬浮解析信息，并支持直接创建缺失组件骨架；对于已存在的本地组件路径，也支持 `Cmd/Ctrl + Click` 直接跳转到组件文件；当本地组件文件在资源管理器中被重命名或移动时，扩展还会自动同步更新引用它们的 `usingComponents` 路径。
