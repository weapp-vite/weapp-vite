---
'@weapp-vite/acceptance': minor
'@weapp-vite/devtools-runtime': minor
'@weapp-vite/eslint': patch
'@weapp-vite/mcp': minor
'create-weapp-vite': patch
'weapp-vite': minor
---

feat(acceptance): 补齐确定性验收、Doctor、构建产物与 HMR profile 的可追溯证据，未知或未完成测量不再被记录为成功或零耗时。

- 复用现有 MCP/runtime 会话提供无模型检查、任务管理和当前代码证据；任务在项目锁释放后再发布完成状态，Windows 报告原子替换遇短暂占用时限时重试并保留持久化与清理错误。
- 共享 Doctor CLI/API 分离默认只读静态检查、显式构建产物和已打开宿主页面探针，提供终端、JSON、SARIF 与完整性退出码；复用平台兼容及预算规则，修正 runtime ESLint 对自定义实例方法和数组/字符串同名方法的误报。
- analyze 产物清单按实际模块所属包区分 runtime、业务及混合输出，保留分包复制来源，明确实际字节、模块分摊估算与未归因部分；新增 runtime 文件上界和单包预算，缺测拒绝报告通过，失败关联具体文件，JSON 构建/清理日志走 stderr。
- profile 固定版本、会话、构建、多文件批次及实际生产者身份，记录源事件、准备、提交等待、提交和发布，区分 classic/stateful 边界；失败、缺失阶段、未知版本和未完成批次不计成功，嵌套阶段不重复累加，保留旧 JSONL 兼容和残差估算口径。
