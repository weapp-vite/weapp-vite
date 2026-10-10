---
'create-weapp-vite': patch
'weapp-vite': patch
---

fix(upload): 修复上传配置优先级、版本更新顺序与 SDK 执行和清理期限，保留远端状态未确认的证据。

- `project.private.config.json` 按官方语义优先于基础配置，并深合并 `setting`，保留双方编译选项；`wv build --upload --bump` 在配置求值前更新版本，使配置和产物一致，纯 Web 选择恢复本地清单和 npm 锁文件。
- 超时/中断清理本地上传进程并明确远端结果未确认，不自动重试、撤回、提审或发布；SDK worker 退出即停止执行计时，避免后续管道/清理误报超时，Windows 身份查询独立有界，清理失败仍保留错误。
