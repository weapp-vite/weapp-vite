# Windows 进程身份查询诊断

## Provider 清理的定向复现

同一 workflow 的 `Provider cleanup query` 在 Windows Node 22/24 上运行原有
`e2e/ci/issue-1065-provider.test.ts`，保留构建、连续 watch 更新、dispose 和重复
stop 的全部断言与原查询预算。`WEAPP_VITE_E2E_CLEANUP_TRACE=1` 分别记录 Node
清理阶段及 PowerShell 的脚本入口、CIM 查询与序列化阶段；超时仍失败并保留已收到的
marker，不重试身份查询，也不授权清理未核验进程。

这个入口只用于定位完整 CI 分片中的清理失败。JSON 测试报告与阶段日志均应保留，
定向通过不能代替完整 CI 清单或真实 IDE 验收。

只需继续采集该场景时，将手动 workflow 的 `scope` 设为 `provider-cleanup`，
避免重复执行已经采集的身份对照。查询报告额外记录 stdout/stderr 长度、原始标记次数
和首个脚本标记是否出现，区分无输出与标记格式未被解析；不保存原始查询输出。

如果单文件通过而完整分片仍失败，手动选择 `CI E2E` 的 `windows-dev-cleanup`
入口。它保持 Node 22 分片 3，并在同一次矩阵中比较 Node 22/24 分片 1；每个 job
先构建包及 E2E 应用，再按原顺序运行完整分片。阶段日志保留前置任务的进程查询上下文，
分片报告只覆盖选中的 task，不能计为四分片合并的完整 CI 验收。

stdin 对照运行中，两种方式均在 Node 22 分片 3 超时；关闭 stdin 不能作为修复，
选择项已移除。原始报告保留脚本开始、查询和序列化阶段，不推定单一根因。

当前矩阵比较原 JSON 与固定行格式。`WEAPP_VITE_E2E_CLEANUP_QUERY_TRANSPORT` 仅在
显式 trace 时允许 `json` 或 `rows`，普通查询保持 JSON。两者读取相同 CIM 快照、
四个字段、完整创建时间和可执行路径，保留十秒期限。行格式用 UTF-16LE base64 传输
路径，并核对固定包络与行数；非法或不完整输出仍拒绝，不回退、不重试。
该候选只用于测量通用 JSON 序列化的固定成本；定向通过不能代替完整正式验收。

## 当前 journal writer 的首次调用检查

```sh
node --import tsx scripts/windowsProcessIdentityProbe/checkSelfWriter.ts
```

在独立 Windows Node 22/24 runner 上运行该入口。它只派发一次新 Node 进程，第一项主动身份查询为生产 journal writer 自查；随后核对缓存，并通过旧 CIM 读取器验证双向精确身份。报告位于 `.tmp/windows-journal-self-writer/report.json`，不保存原始可执行路径，不启动 IDE，不清理任何宿主。外层三十秒 supervisor 包含模块加载、首次自查和后续 CIM 对照；每个生产查询的预算仍为十秒，不能覆盖或扩大。

这项检查只证明当前自有 Node writer 的观测，不证明操作系统从未预热，也不能替代任意宿主、跨权限或退出竞争验证。生产变更只用于 writer 自查；通用宿主与旧锁读取、身份精确比较及失败阻断保持原契约。下面的四组历史诊断继续用于解释边界，不能将其结果泛化成所有宿主已通过。

## 历史通用查询对照

原 probe 比较通用生产 CIM 查询与 `.NET Process` 候选，只收集诊断证据，不启动 DevTools，也不参与所有权、清理或 runtime 验收决策。生产 `host.ts` 与 `sameManagedProcess` 保持不变。

## 首次样本和后续样本

手动运行 `Windows Process Identity Probe` workflow。矩阵保留 Node 22、24，并为每个 Node 版本分别创建 `cim` 与 `candidate` 优先的独立 Windows runner job。各组安装和构建步骤相同，artifact 名包含 Node 版本、首个 provider 与提交 SHA。

每个 job 只把本脚本发出的第一条 PowerShell 查询标为 `first-script-powershell-query`。新 runner 不证明操作系统、runner 服务或前面的安装步骤从未使用 PowerShell/CIM；报告明确保留这个限制。

对同一个存活 PID，顺序为：

1. 首选 provider 的首次查询。
2. 首次取得完整身份后，再做一次预先安排的重复采样；首次身份不可用时不重试。
3. 另一 provider 的首次及重复采样，同样不重试失败。
4. 两次 CIM 样本都取得完整身份时，调用原生产 `readManagedProcessIdentity` 核验表示；否则记录未执行，避免失败后变相重试 CIM。
5. 最后记录 startup-only。这一项已经经过预热，不能当成 PowerShell 冷启动基准。

随后沿用受控子进程的存活与正常退出检查。每条身份查询仍使用原来的 10000 ms 预算；外层 supervisor 只限制模块加载和失败收尾，不接受扩大后的查询预算。缺失、错误、超时和未执行的重复采样分别记录。

## 阶段计时

两种 provider 使用相同的 `execa` 参数与诊断包装。PowerShell 脚本第一条语句向 stderr 写入口 marker；父进程记录 `scriptEntryMs`。脚本内 Stopwatch 记录 `queryBodyMs` 与 `serializationMs`，阶段证据收到后即写入报告，supervisor 中止时也保留已经收到的部分。

- `scriptEntryMs` 包含进程启动、PowerShell 初始化、调度和 marker 管道传递，不能声称它只是 PowerShell 自身耗时。
- `queryBodyMs` 包含 provider 查询和身份构造；CIM 组也包含首次 cmdlet/module 加载，不能直接等同于 WMI 服务启动。
- `serializationMs` 包含身份或错误 JSON 的生成与 stdout 写出。
- `elapsedMs` 仍保留整个子进程调用时间。缺少、重复或无效 marker 时，`phaseEvidenceComplete` 不为真，不填补不存在的阶段耗时。marker 完整性与 `timedOut`、`failed` 独立记录；即使两个 marker 都已收到，退出阶段仍可能超时，不能将 `phaseEvidenceComplete` 视为查询或进程成功。

首个 CIM 样本入口快而查询阶段慢，支持继续检查 CIM/module/provider 路径；入口阶段本身慢，则应检查 PowerShell 启动、调度与系统扫描等因素。候选必须看 `candidate` 优先组的首个样本，不能拿 CIM 之后的候选样本证明冷启动改善。每个 runner 只有一个首次样本，不能据此声明稳定收益、P95 或 Node 版本因果关系。

## 旧身份兼容性

候选保留原始 100ns `Started` 和十进制 tick 字符串，并单独输出 `LegacyStarted`。后者用整数余数截断到微秒，仍输出 UTC 七位小数；不使用 JavaScript `Date` 或浮点数转换 tick。

同 PID 的对照同时记录原始字符串是否相等、兼容字符串是否与 CIM 精确相等、兼容字符串是否等于原始值的预期截断、路径是否精确一致、前后代次与存活状态。`candidateContractAgrees` 只表示该次观测满足这些条件，不代表候选已获准进入生产。

初始 `.NET GetProcessById` 的明确缺失可返回 missing；字段读取失败、权限错误、查询期间退出、前后 tick 不一致都返回错误。原始错误类型、HResult 和可用的 NativeErrorCode 随报告保存，不能用这些错误冒充“进程不存在”。

报告不保存原始可执行路径或 stdout，路径在内存中精确比较并以 hash 表示；stderr 只保留 marker 与脱敏错误。此轮仅覆盖本任务创建的 Node 进程，尚不能证明受限权限、跨位数目标、任意退出竞争和 PID 复用的生产正确性。

生产接入还必须验证旧 journal/锁的双向兼容。`sameManagedProcess` 目前精确比较 `started` 和路径；仅改成 100ns 字符串可能把活跃旧锁误认为过期，不能通过放宽比较或增加超时解决。

## 本地纯数据检查

```sh
pnpm vitest run scripts/windowsProcessIdentityProbe/identity.test.ts
pnpm exec eslint scripts/windowsProcessIdentityProbe .github/workflows/windows-process-identity-probe.yml
```

纯数据检查验证报告解析与兼容性判定，不运行 Windows 查询，也不代替远端首次样本。
