---
'create-weapp-vite': patch
---

修复非 wevu 原生模板缺少 `wevu` 依赖的问题。现在 `default`、`tailwindcss`、`vant`、`tdesign` 模板在保留 `wevu/api` 子路径导入与 `wpi` 跨平台调用方式的同时，会正确声明 `wevu`，避免通过 `pnpm create weapp-vite` 生成项目后在 `wv build` 阶段出现 `Rolldown failed to resolve import "wevu/api"` 的构建失败。
