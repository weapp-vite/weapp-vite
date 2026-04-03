---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `autoRoutes` 在无 `pages/` 目录的分包根目录下误把共享脚本模块识别为页面的问题。现在像 `subpackages/item/issue-340-shared.ts` 这类仅供其他页面复用的裸脚本文件，不会再被写入 `dist/app.json` 或自动路由类型定义，从而避免 `pnpm dev:open` / 首次编译时微信开发者工具因为找不到对应 `.wxml` 页面文件而报错。
