---
"@weapp-core/init": patch
"create-weapp-vite": patch
---

修复 `project.config.json` 与 `project.private.config.json` 末尾空行问题，避免微信开发者工具打开后反复产生无意义改动；同时在提交阶段自动清理这类文件的文件尾换行。
