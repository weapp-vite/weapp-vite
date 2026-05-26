---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复小程序构建处理 `srcRoot` 外部链接 Vue 组件时可能向上误读 monorepo 根 `tsconfig.json` 的问题，默认将 Rolldown 的 `tsconfig` 收敛到当前项目目录，同时保留用户显式配置。
