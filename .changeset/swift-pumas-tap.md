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

将仓库内模板默认的 `dev`、`build`、`open`、`generate`、`prepare` 等 CLI 脚本调用从 `weapp-vite` 统一切换为 `wv`，让模板项目与当前推荐的命令别名保持一致。同时为脚手架生成的新项目默认注入根目录 `AGENTS.md`，明确告知 AI 代理安装依赖后优先阅读 `node_modules/weapp-vite/dist/docs/` 下的随包文档，并在做小程序截图验收时优先使用 `weapp-vite screenshot` / `wv screenshot`，在需要查看终端日志时优先使用 `weapp-vite ide logs --open` / `wv ide logs --open`。此外，`weapp-vite` npm 包会同步发布 `dist/docs` 本地文档目录，减少 AI 在其他仓库里依赖过时外部资料的概率。同步补充 `create-weapp-vite` 的版本变更，确保脚手架生成的新项目默认携带同一套命令与 AI 指引。
