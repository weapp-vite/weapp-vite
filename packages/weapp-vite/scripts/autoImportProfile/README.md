# Auto Import 独立诊断

这个入口用于定位同一提交下自动导入相对手写 `usingComponents` 的额外成本，不是主线和 PR 的提交对比，也不产生正式性能验收结论。

云端先运行 `pnpm build:pkgs:ci`，再执行：

```sh
node --import tsx packages/weapp-vite/scripts/autoImportProfile/index.ts
```

默认对 1、100 个组件分别运行两轮，每轮先手写注册、再自动导入。两组分别保留正常支持文件和禁用支持文件的干预对照，始终串行。禁用支持文件只用于隔离成本，不能作为产品通过条件。所有预定样本都会收集，失败不会触发自动重试，也不会在出现快样本后提前结束。

场景数量沿用正式 benchmark 的 `slice(0, requestedCount)` 语义。当前 resolver 清单有 69 项，因此名义 100 组件场景实际使用 69 项；报告同时记录 requestedCount 与 actualCount，不因请求数超过清单长度而拒绝运行。

每个进程先按正式 benchmark 的 `ready -> GC -> 首次写入 -> 实际 WXML marker` 流程测量，再立即连续完成三次新的 marker 更新；没有额外等待或择优采样。每次更新用独立 marker，记录全部耗时。默认 120ms 文件监听 polling 与 10ms 产物轮询均保留。首更与后续更新可用于区分启动后台任务竞争和持续成本，不能用后续较快更新替换首更。

`metadata.json` 保存提交 SHA、CLI 文件散列、Node/OS/CPU、采样配置和 trace 开关；每次样本的 `run.json` 保存 startup、GC 内存及更新时间线。`dev.log` 保存实际子进程输出和 snapshot 阶段日志，`hmr-profile.jsonl` 由已有框架采样入口产生；如果框架未输出该文件，不能把缺失阶段记为零耗时。Trace I/O 会影响耗时，本诊断不能替代关闭 trace 的原始完整门禁。

源码按 fixture 与采样两部分拆分。fixture 是正式 `benchmark-auto-import-hmr.ts` 在诊断提交基线上的快照，保持目录、resolver stub 和配置一致，避免调整正式 benchmark 的行为。这个短期诊断分支不应作为独立长期 fixture 维护；若保留工具，应另行抽取经过回归验证的共享 fixture。

原始数据保留在 runner 的 `.tmp/auto-import-profile`；已存在的报告目录会报错，重新采样须指定新的 `AUTO_IMPORT_PROFILE_REPORT_DIR`，避免混入旧证据。工作流仅上传明确标为 sanitized 的脱敏副本与原始/脱敏散列索引，三天后删除 artifact；不能把脱敏散列当作原始文件散列。不会改动正式 benchmark 的双阈值或采样规则。

参数、目录或 metadata 初始化失败时，错误 name、code 与脱敏 message 会打印并写入独立的 `.tmp/auto-import-profile-startup-errors-sanitized` artifact。错误记录使用独立新目录，不覆盖旧采样，也不包含 stack。可通过 `node --test packages/weapp-vite/scripts/autoImportProfile/diagnostics.test.mjs` 运行纯文本回归检查。
