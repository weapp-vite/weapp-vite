---
"weapp-ide-cli": patch
---

补齐 `weapp-ide-cli cache` 命令的参数校验与使用示例。现在 `cache` 命令会显式校验 `--clean/-c` 是否传入，以及清理类型是否属于 `storage`、`file`、`compile`、`auth`、`network`、`session`、`all`；同时同步补充 `weapp-vite` 与 `weapp-ide-cli` 文档中的缓存清理示例，明确该能力已作为正式 CLI 集成能力提供。
