---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

增强微信开发者工具启动前的本地配置预热能力。`weapp-ide-cli` 现在会在 `open`、`auto`、`auto-preview` 与 automator 启动前自动补齐 DevTools 安全设置，并可按命令参数或全局配置自动信任目标项目；同时新增 `autoBootstrapDevtools`、`autoTrustProject` 配置项与更直观的 `config show` / `config doctor` 输出。`weapp-vite` 复用了这套底层能力，新增 `ide setup` 命令，并让 `open`、`dev --open`、`build --open` 共享同一套 DevTools 预热与项目信任策略。
