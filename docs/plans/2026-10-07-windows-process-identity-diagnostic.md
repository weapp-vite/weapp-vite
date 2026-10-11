# Windows 进程身份查询诊断

现有 Windows CI 在外层命令 journal 和 Vitest 全局初始化两处出现 `readManagedProcessIdentity` 的 10 秒 CIM 超时。先在真实 Windows 上采集诊断，再决定是否替换生产算法；保持现有 journal、scope、清理和超时预算。

独立 `Windows Process Identity Probe` workflow 只支持手动触发，在 Node 22、24 的 Windows runner 上执行。首个 PowerShell 查询通过源码中的生产函数运行，后续使用真实 execa 串行比较相同 PID 的 CIM 与 .NET 候选，并测量空 PowerShell 启动。目标仅为诊断脚本自身与它显式创建的 Node 子进程；子进程正常退出后，再采集三条查询路径的缺失或错误结果。

每条身份查询保留 10 秒预算。源码调用另用 Node supervisor 隔离，额外时间只允许加载模块与失败收尾；超出 supervisor 边界立即停止采集，不重试、不扩大身份查询预算。各阶段启动前与完成后写报告；单次等待及整个采集都有有限边界。所有清理只操作脚本直接创建并登记的进程。

报告记录耗时、退出码、信号、超时、查询错误阶段、可执行文件哈希、精确相等结果、完整启动时间与 .NET ticks。可执行文件路径仅在内存比较，错误路径脱敏。CIM 微秒与 .NET 100ns 的差异单独记录；微秒文本相同不代表现有 `sameManagedProcess` 身份相同，也不能授权回收旧 journal owner。

workflow 成功只代表完成诊断采集，报告始终标记 `diagnostic-only-not-acceptance` 和 `acceptance: not-evaluated`。生产查询失败仍保留原结果。拒绝访问与任意进程退出竞争未在本次受控 Node 目标中覆盖，不能据此宣称候选实现已满足生产合同。

本机验证仅执行纯数据处理单测和静态 lint，不启动 PowerShell。实际 API、异常封装、时序和旧身份兼容性均以该 Windows workflow 的报告为证据。
