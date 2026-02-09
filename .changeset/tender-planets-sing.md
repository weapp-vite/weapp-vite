---
"weapp-ide-cli": patch
---

style: 优化登录失效重试提示的终端染色层次。

- 复用 `@weapp-core/logger`（consola）能力，将提示按 `error/warn/info/start` 分级输出。
- 登录失效摘要与重试引导改为有层次的彩色输出，更易快速识别关键步骤。
- 补充对应单元测试，覆盖新的日志方法调用。
