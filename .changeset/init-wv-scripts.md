---
"@weapp-core/init": patch
"create-weapp-vite": patch
---

调整 init 生成的 package scripts，默认使用 `wv` 短命令写入 `dev`、`build`、`open` 与 `g` 等脚本，避免新迁移项目继续暴露冗长的 `weapp-vite` 全写命令。
