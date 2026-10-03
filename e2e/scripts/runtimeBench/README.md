# 发布消费者运行时基准

报告保持 schemaVersion 2，兼容字段 `hostHeapBytes` 与 `hostHeapCapability` 保留，分别映射到后置样本的 usedSize 和可用状态；完整前后能力与不支持原因见新增字段，不支持时兼容值仍为 null / unavailable。

普通与 performance 预设共用同一份 Vue 输入和候选归档；首屏、提交阶段、可见 DOM 与工作负载使用现有 runtime benchmark 会话。多个场景通过 `reLaunch` 串行执行，沿用原有真实 AppID 与页面条件，不创建额外 IDE 实例。

更新样本的 `memory.hostHeapBefore` / `hostHeapAfter` 在工作负载计时之前及结束之后分别调用 `getAppServiceHeapUsage`。每份记录包含 provider、实际 Tool.getInfo 返回的 IDE/SDK 版本和能力结果。`wallMs` 在后置探测前固定，worker RSS 也单独保留；不把协议探测延迟计入更新耗时，不将 worker RSS 解释为宿主内存。

有效宿主结果是 AppService JS 堆当前已用/已分配字节；没有强制 GC，不代表峰值或 renderer/native 总内存。已知不支持保留明确原因；headless 直接记录 `not-devtools`，不调用真实 IDE 内存接口。接口缺失、无效数据、连接超时和其他协议故障导致本轮失败，不制造零值或沿用上一份样本。IDE/SDK 元数据缺失保留 null，不能用 Node 或浏览器版本替代。

测量入口仍是 `e2e/scripts/runtime-bench.ts` 的发布消费者预设对照。真实运行前由执行者记录官方 Stable 查询时间、所选 CLI、实际 IDE/基础库版本；本目录单元测试不启动 IDE、浏览器或 headless runtime。

```sh
pnpm vitest run -c e2e/scripts/runtimeBench/vitest.config.ts
```

原始样本、产物字节、phase、可见结果及内存能力共同决定最终结论。`complete` 表示当前配置的采集流程完成；若宿主不支持 heap 或未完成 Stable runtime，#1137 的内存/目标宿主验收仍未完成，不发布收益结论。
