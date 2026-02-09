---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

chore: 统一 CLI 中优先级输出风格与终端染色。

- `weapp-ide-cli`：补齐 `colors` 相关测试 mock，确保配置解析与 `minidev` 安装提示在新增染色后行为稳定。
- `weapp-vite`：对齐 `openIde` 重试提示日志级别（`error/warn/info`），并统一通过 `logger.colors` 做重点信息高亮。
- `weapp-vite`：优化运行目标、构建完成、分析结果写入等高频输出，统一命令/路径/URL 的染色展示。
- 包含 `weapp-vite` 变更，按仓库约定同步 bump `create-weapp-vite`。
