---
'@weapp-agent/cli': minor
'create-weapp-vite': minor
---

feat(scaffold): 更新脚手架工具链选择与 Weapp Agent 工作流，并联动框架、Dashboard 和 IDE 验收使用契约。

- 新增与业务模板独立的 `--toolchain=wv|vite|vite-plus`，生成共享配置、多平台及组件库脚本；保持 Vite+ 引擎 alias、配套 Vitest、严格 peer、依赖覆盖与 Node 要求一致，保留小程序命令、检查及受管类型流程。
- 迁入独立 Weapp Agent CLI，兼容旧命令、配置和会话，生成统一验收指引；联动 Dashboard/Hub、品牌图标、受控调查及框架增量查询能力。
- 长任务压缩保留完整用户要求，准确处理重复工具调用 ID 与中断结果；新增只读会话详情及交互确认恢复，上下文预算不足明确停止，避免重放操作。
- 等待恢复确认期间保存追加要求和图片，确认后顺序交付；并发恢复仅允许一个 writer，关闭等待日志写完，避免覆盖其他会话锁或损坏记录顺序。
