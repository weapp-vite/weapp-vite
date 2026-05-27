---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `sitemap.json` 与 `theme.json` 这类 app 侧边 JSON 被误按 `app.json` 归一化的问题，避免输出中额外写入空的 `subPackages` 字段。
