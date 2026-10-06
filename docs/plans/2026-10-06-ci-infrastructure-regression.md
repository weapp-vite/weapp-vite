# 全量回归中的 CI 基础设施修复

本轮真实 IDE 继续使用用户明确接受的 Stable `2.02.2608070`，显式设置
`WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION`，官方查询与实际宿主核验保持启用。
以下问题来自提交 `1b0b631b56edf7657bc04b1a70846d840458f599` 的远端验证。

## Windows 进程身份查询

Windows HMR 和多个 CI shard 在进入测试之前失败于 journal writer 身份检查。
Windows DOM contracts 的后续调用则立即重复失败，因为模块永久缓存了第一次被拒绝的 Promise。

三个独立诊断工作流分别确认了原查询失败、替代查询的冷启动行为和完整冷启动耗时：

| 诊断 | 观察 | 结论 |
| --- | --- | --- |
| run `37469181440` | 原 CIM 首次在 3 秒超时，之后的查询较快 | 不能仅根据热查询结果更换算法 |
| run `37470679336` | 首次改用 .NET 后仍在 3 秒超时 | 共同的 PowerShell 初始化也占用预算 |
| run `37471629556` | 新 runner 的原 CIM 首次约 3.77–3.92 秒，后续约 0.46–0.48 秒 | 原 3 秒预算早于有效响应返回 |

最后一轮另用新 runner 测量空 PowerShell：首次约 1.65–2.30 秒，随后首次 CIM
约 1.64–2.07 秒。冷启动包含 shell 与查询设施的初始化。诊断使用的 15 秒仅为测量上限，
没有将放宽预算后的诊断结果计作正式 E2E 通过。

生产修复保留原 CIM 命令、完整路径、创建时间精度和严格身份比较。Windows 单次检查
上限设为 10 秒，Unix 保持 3 秒；调用者更小的正预算和取消信号仍优先。零、负数和
`NaN` 在启动进程前拒绝，防止 `execa` 将 `timeout: 0` 解释为禁用超时。
受管检查失败保留退出码、信号、超时标记和预算摘要。

10 秒是单次查询上限，多个受管身份查询仍会串行叠加，不代表关闭操作的总时间不变。
启动操作的绝对期限由原有 operation lifecycle 约束；清理仍需完成身份核验、关窗和端口
回收后才能释放机器租约。没有预热、内部重试或未知资源清理。

journal writer 继续共享在途查询并缓存成功身份。失败仍拒绝同批调用，仅清空失败缓存，
允许下一次显式操作重新核验。缺失元数据不能缓存为成功。

## DOM 报告保留原始异常

Vitest 5 在 global setup 抛错后，仍在 `finally` 中执行报告器。该异常尚未进入 reporter
收到的 errors 列表，空 modules 使结束原因成为 `failed`。原 DOM 报告器再次抛出严格验收
异常，覆盖了原错误，日志因此只剩“未找到测试文件”和零 case 的严格验收失败。

已经失败或中断的运行仍保存失败报告、设置非零退出码并输出严格验收摘要，但不再抛出
替代异常。Vitest 判定通过而 DOM 不完整时仍抛出严格验收错误。真实 Vitest 子进程回归
覆盖 setup 原错误、非零退出、零用例执行和失败报告；修复前该回归无法读取原错误。

## 构建前契约检查与 Windows 预加载

教程 npm lane 在构建工作区包之前执行契约检查。纯基础设施配置改用只持机器租约的
setup，journal 环境变量名移到无依赖模块并保留原入口重导出，避免加载未构建的包入口。
真实 IDE 和带受管资源的 E2E 配置仍使用原严格 scope setup。

恢复子进程的 Node `--import` 参数改用 `pathToFileURL`，避免将 Windows 盘符解释成 ESM
协议。场景、退出断言和资源清理条件不变。

## headless HMR 回环传输

macOS Node 24 的 topology 场景完成了两个 case 和十二个 checkpoint，但 Node 内置 Undici
在 socket 写入回调中抛出 `setTypeOfService EINVAL`。普通 fetch Promise 的 catch 无法
捕获该异常，严格报告正确保留了失败。

专用回环 POST 使用 `node:http` 的独占短连接，保留 JSON 协议、HTTP 状态、请求取消、
pending 回收以及成功回调后执行 emitted 更新文件的顺序。真实 HTTP/TCP 回归覆盖取消、
重复 reset 和响应体中途断开；未屏蔽运行错误或放宽 DOM 断言。

## 当前验收边界

原提交的本机 CI E2E 为 92/92 task 通过，headless full 为 71/71，DOM headless 为 61/61。
真实 IDE 生命周期验收在首个 worker 首屏前出现宿主 `simulator launch failed`，未完成
最终验收；后续 gate/full/exhaustive 没有执行。该轮任务窗口峰值为一，最终归零，原生
窗口销毁、端口关闭和 journal 释放均有记录，Computer Use 确认只剩项目列表。

资源门槛还发现 classic 重复构建的 heap 与 GC 次数增长。三轮 tiny Vite build 的 heap
实验确认长期 object hook 会保留历史 environment；隔离该 hook 后仍有独立的 native
保留路径。因此没有把仅复制 hook 的候选应用为完整内存修复，也没有放宽资源阈值。

以上旧提交的通过项与失败项保留原记录。新修复仍需在最终同一提交上完成本地和远端验证。
