---
'create-weapp-vite': patch
'weapp-vite-template': patch
'weapp-vite-lib-template': patch
'weapp-vite-tailwindcss-template': patch
'weapp-vite-tailwindcss-tdesign-template': patch
'weapp-vite-tailwindcss-vant-template': patch
'weapp-vite-wevu-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'weapp-vite-wevu-tailwindcss-tdesign-retail-template': patch
---

将仓库内模板默认的 `dev`、`build`、`open`、`generate`、`prepare` 等 CLI 脚本调用从 `weapp-vite` 统一切换为 `wv`，让模板项目与当前推荐的命令别名保持一致。同步补充 `create-weapp-vite` 的版本变更，确保脚手架生成的新项目默认携带同一套启动命令。
