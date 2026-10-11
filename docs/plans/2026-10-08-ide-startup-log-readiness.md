# IDE 启动日志与页面就绪

## 已观察的问题

真实 IDE 回归中，同一窗口先记录通用 `simulator launch failed`，随后记录 `webview page ready`，并完成原有 runtime 断言。旧扫描器在一次扫描同时读到两条日志时允许继续；首次扫描先读到错误时立即中断并冷启动重试。因此轮询时机改变了同一启动序列的结果，增加了窗口创建次数。

这份证据只说明通用日志不足以立即判定启动失败，不能证明所有模拟器错误都可以恢复，也不能用来认定或排除此前的 OOM 原因。

## 判定与预算

仅完整、无附加错误细节的 `simulator launch catch error Error: simulator launch failed` 可以进入 pending，且必须有明确窗口 ID。`MaxSubPackageLimit`、`subPackages`、缺失文件、其他具体错误及身份不明的通用错误立即失败。

pending 只能由同一日志文件内、该错误之后、相同窗口 ID 的 `webview page ready` 变为 recovered。其他窗口、其他文件、早于错误的 ready、`launch success` 和日志消失都不是恢复证据。一个通用错误恢复也不能抵消同次扫描中的致命错误。

监控保留首次诊断及恢复回执，报告分别记录 pending 与 recovered。首次扫描已经读到 ready 时同样保留两条事件，避免轮询快慢影响报告事实。未恢复错误不会因日志截断或轮换而丢失；失败后不再扫描新日志倒推先前启动成功。

连接及日志订阅继续使用原有启动 lifecycle。订阅完成后若仍有 pending，在同一 deadline 内只轮询日志，不触发编译、导航或新窗口；随后执行原有页面 warmup 与断言，交付 session 前再次核验。等待耗尽预算时以首错作为启动失败诊断，并保留原 timeout/cancellation cause。日志确认的启动失败不再进入冷启动重试。完成启动后新增错误仍立即失败，不沿用启动期等待策略。

## 代码边界与验证

`devtoolsSimulatorBootDiagnostics.ts` 只解释日志证据；`ide-devtools-logs.ts` 继续负责文件、字节基线和时间筛选，并保留原扫描 API 的返回格式。`automatorBootLogMonitor.ts` 管理一次启动的诊断状态与预算等待。两项提取避免继续扩大超过 300 行的 `automator.ts`，也使日志扫描文件降到 300 行以内。原有较大的启动 resilience 测试只调整必要的 mock 和冷启动契约，其余测试保持原位置。

确定性测试覆盖跨轮询恢复、同轮询恢复、超时首错、错误窗口或文件、早到 ready、日志截断、致命初始化失败，以及完成启动后再失败。启动入口契约验证 pending 期间不导航、成功和超时均只启动一次、致命错误不冷启动、迟到 session 仍按原所有权清理。真实 IDE 验收仍需原 runtime 场景通过；本说明和 mock 结果不替代真实验收。
