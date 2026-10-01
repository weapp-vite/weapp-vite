---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

将开发者工具 CLI 的配置、连接和恢复诊断统一输出到 stderr，避免污染验收与其他自动化命令的 JSON 标准输出，同时保留诊断信息。
