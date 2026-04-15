---
"create-weapp-vite": patch
---

调整 `create-weapp-vite` 的项目初始化行为：执行 `pnpm create weapp-vite` 创建新项目后，会把生成目录中的 `project.config.json.appid` 统一改写为 `touristappid`，避免直接继承仓库模板里的真实 AppID。
