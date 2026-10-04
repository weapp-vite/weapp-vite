# 发布消费者运行时基准

报告保持 schemaVersion 2，兼容字段 `hostHeapBytes` 与 `hostHeapCapability` 保留，分别映射到后置样本的 usedSize 和可用状态；完整前后能力与不支持原因见新增字段，不支持时兼容值仍为 null / unavailable。

普通与 performance 预设共用同一份 Vue 输入和候选归档；首屏、提交阶段、可见 DOM 与工作负载使用现有 runtime benchmark 会话。多个场景通过 `reLaunch` 串行执行，沿用原有真实 AppID 与页面条件，不创建额外 IDE 实例。

更新样本的 `memory.hostHeapBefore` / `hostHeapAfter` 在工作负载计时之前及结束之后分别调用 `getAppServiceHeapUsage`。每份记录包含 provider、实际 Tool.getInfo 返回的 IDE/SDK 版本和能力结果。`wallMs` 在后置探测前固定，worker RSS 也单独保留；不把协议探测延迟计入更新耗时，不将 worker RSS 解释为宿主内存。

有效宿主结果是 AppService JS 堆当前已用/已分配字节；没有强制 GC，不代表峰值或 renderer/native 总内存。已知不支持保留明确原因；headless 直接记录 `not-devtools`，不调用真实 IDE 内存接口。接口缺失、无效数据、连接超时和其他协议故障导致本轮失败，不制造零值或沿用上一份样本。IDE/SDK 元数据缺失保留 null，不能用 Node 或浏览器版本替代。

测量入口为 `pnpm e2e:runtime-bench --published-presets --tarballs=<目录> --output=<报告>`（`e2e/scripts/run-runtime-bench.ts`）。真实运行前由执行者记录官方 Stable 查询时间、所选 CLI、实际 IDE/基础库版本；本目录单元测试不启动 IDE、浏览器或 headless runtime。

两套消费者必须具有相同的源码、候选 tarball 和完整安装依赖闭包；第二套安装完成后先核对闭包，再开始其采样。`collectionComplete` 仅表示两套数据采集结束，`memoryEvidence` 单列每个更新样本前后的宿主堆证据及缺失原因。宿主返回 unsupported 时保留原始 reason，并令 `complete: false`；worker RSS 不能补齐该证据。

每个正式样本结束后在计时之外原子保存 `runtime-bench-evidence.json`，预热不进入正式样本。中途失败的已完成样本、完整输出清单、采集错误和宿主清理错误随最终报告归档。采样、内存或清理不完整时保留本次消费者目录，并在本机诊断输出打印位置；归档失败也保留目录。只有完整报告先成功归档且所有验收证据齐全后才删除本次消费者，成功关闭宿主之后才发布 worker 结果。

会话恢复前将失败的样本名称、attempt 和原因写入 `attemptFailures` 与 `failures`。恢复后的样本可以继续留作诊断，但存在失败尝试的整轮结果仍为 failed，不能用替代样本生成通过的性能结论。

首屏与详情导航的 `firstCommitMs` / `firstCommitMsMedian` 保持 null；ready marker 和包含固定等待的 wall time 不代表首个 host commit。更新场景继续独立保存宿主提交阶段与 DOM 可见观测，不改变工作负载、预热次数、正式采样次数或计时边界。

首屏与详情导航同时核对实际路由、可见节点、页面专属 `readyMarker` 和有限非负的 `loadToReadyMs`。两页共用的 DOM id 不能单独证明导航成功；页面方法返回空对象或缺失 ready 指标时本轮失败，不将缺失值记录成通过的样本。

```sh
pnpm vitest run -c e2e/scripts/runtimeBench/vitest.config.ts
```

原始样本、产物字节、phase、可见结果及内存能力共同决定最终结论。`complete` 要求两套采样完成、输入与安装闭包等价、宿主 heap 证据齐全、报告归档及资源清理成功；只有采集结束时使用 `collectionComplete`。官方 Stable 渠道身份仍由附带的官方查询时间、所选 CLI 与实际宿主版本证据判定，不能仅凭 `complete` 推导。heap 不支持或 Stable 身份证据缺失时，#1137 对应验收仍未完成，不发布收益结论。
