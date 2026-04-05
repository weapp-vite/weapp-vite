---
"@weapp-vite/miniprogram-automator": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复微信开发者工具自动化会话在启动抖动阶段容易误判为“HTTP 服务端口未开启”的问题。现在会在 `Extension context invalidated`、websocket 启动超时等可恢复场景下自动重试一次，并在仍然失败时输出更贴近真实状态的错误分类。同步修正 `weapp-vite-tailwindcss-vant-template` 的布局演示页操作区排版，避免 `@vant/weapp` 按钮以内联方式挤压换行导致页面错乱。
