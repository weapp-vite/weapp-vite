---
'weapp-vite': patch
'weapp-ide-cli': patch
'@weapp-vite/miniprogram-automator': patch
'create-weapp-vite': patch
---

继续增强微信开发者工具命令链路的稳定封装。`weapp-ide-cli` 新增了更完整的程序化命令层与顶层 helper 分发，覆盖 `open`、`login`、`preview`、`upload`、`cache`、`close`、`quit`、`build-npm`、`open-other`、`auto`、`auto-replay`、`build-apk`、`build-ipa`、`reset-fileutils` 等官方命令，同时补充了 DevTools HTTP `engine build` 流程与 `Tool.*` typed wrapper；`weapp-vite` 则开始在 IDE 顶层转发、统一执行器与 `npm` / `close` 等入口优先复用这些稳定 helper，减少对原始 argv 透传和官方 CLI 黑盒行为的直接耦合。
