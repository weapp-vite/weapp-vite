---
'@weapp-vite/vscode': patch
---

修复 VS Code 扩展对常用 `weapp-vite` 脚本的缺失诊断与自动补齐逻辑：现在会按命令候选名识别已有脚本，例如 `scripts.g = "weapp-vite generate"` 或 `scripts["dev:open"] = "wv dev --open"` 不会再被误判为缺少 `generate` / `dev`，插入常用脚本时也不会重复补出等价命令。
