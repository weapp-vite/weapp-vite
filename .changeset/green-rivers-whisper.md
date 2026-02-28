---
"weapp-ide-cli": patch
---

重构 weapp-ide-cli 的命令解析与 automator 执行架构，统一参数解析、登录重试与会话生命周期处理；同时修复 automator 命令测试导入路径问题并补齐结构化分层实现，提升后续扩展和维护稳定性。
