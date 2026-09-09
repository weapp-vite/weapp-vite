# Workspace HMR 云端诊断

此目录只用于诊断分支，结果不替代主分支的最终 IDE 或 CI 验收。audit.ts 是 scripts/audit-workspace-hmr.ts 的观测副本；保留原有流程以比较原失败的测量窗口。文件超过 300 行的原因是避免诊断期间同时重构正式审计器；源码和副本生成摘要见 generation.json。

前置条件与现有 Workspace HMR workflow 相同：安装仓库依赖并构建本地包，特别是最新 weapp-vite dist。随后运行：

```sh
node scripts/workspaceHmrProfile/run.mjs
```

包装器固定串行执行 3 轮，全部保留，不以某一轮通过覆盖失败；任一轮失败则最终返回非零。每轮固定 apps/wevu-jsx-tsx-demo；保留 warmup、native-script、vue-template、vue-script 及每次恢复的完整顺序，原有 impact 阈值 12、250ms settle、1000ms stable、write/native 不变。诊断副本关闭自动重试，每轮的每个场景只执行一次。它不改产品源码或 dist，仅通过正式 CLI 启动 dev，并使用原有审计恢复逻辑。

所有结果写入 .tmp/workspace-hmr-profile/round-1 至 round-3，根目录 rounds.json 记录计划数、执行数与退出状态，metadata.json 保存提交 SHA、CLI 散列、运行环境及 trace 配置。包装器不把子进程 stdout/stderr 或未脱敏的步骤摘要转发到 Actions，只报告相对轮次和退出状态。每轮包含：

- report.json、report.md、thresholds.md：原审计结果，仍按原阈值失败。
- dev-output.log：成功场景也保留完整 dev 输出；dev.log 另保留子进程完整 stdout/stderr。
- timeline.json：带墙钟和单调时钟的源码写入、measurement before/after、既有每轮 dist 快照、恢复 marker 与稳定等待返回。
- blobs/<SHA256>：读取过的原始产物与写入过的 fixture 源码，用于确定同尺寸文件是否仅 buildId 改变。

原始产物包括运行时 control token、服务 URL 等临时值。原始目录留在 runner，上传前生成独立脱敏目录：

```sh
node scripts/workspaceHmrProfile/sanitize.mjs .tmp/workspace-hmr-profile .tmp/workspace-hmr-profile-artifact
```

sanitizer 保留事件顺序、相对组件路径与原始 hash 引用，替换仓库/用户/临时目录前缀、控制 token 和 localhost origin，覆盖 JSON 与 URL 编码形式。blobs 文件名仍是原始 hash，内容已脱敏，sanitization-manifest.json 明确映射 rawSha256 到 sanitizedSha256；因此不能把脱敏内容的 hash 误认为原始 hash。无法检查的二进制只记录省略状态，不上传。缺失/空输入或已存在的输出目录返回非零，禁止上传部分脱敏目录。

只上传脱敏目录，不能上传 raw 路径。可用 node --test scripts/workspaceHmrProfile/sanitize.test.mjs 运行独立纯文本自测，不启动 dev 或 E2E。

没有增加周期采样、固定等待或放宽断言。既有 snapshot 已读取的字节按摘要缓存在内存，审计结束后落盘。hash 与日志保留仍存在观测开销；单次通过不能证明旧失败已经解决。

已开启 WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE=1，可观察 source-change、request、batch、snapshot、实际 write full/refresh/additional。现有产品 trace 尚不含 snapshot entryIds 差集、native patch 取出的 source reasons 或 baseline hash owner；若只能观察到 refresh 批次里的 full，必须补充最小内部证据才能归因，不能直接猜测入口变化。
