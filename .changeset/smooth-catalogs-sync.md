---
"@weapp-core/shared": patch
"create-weapp-vite": patch
"weapp-vite": patch
"@weapp-vite/web": patch
---

补齐抖音平台描述符在 `@weapp-core/shared` 中的发布记录，并同步脚手架模板 catalog 与运行时依赖版本：模板依赖更新到 `magic-string@^1.1.1`、`rolldown@1.2.4`，`weapp-vite` 同步 `@vercel/detect-agent@^1.2.5`，Web runtime 统一使用 workspace catalog 中的 Rolldown 版本。
