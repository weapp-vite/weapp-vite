---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 request globals 安装器内联到 app 注册模块后，ESM 页面入口和 app.prelude 仍可能引用已删除 runtime chunk 的问题，并收窄 app.json 归一化范围，避免 sitemap 等旁路 JSON 被误当作 app 配置处理。
