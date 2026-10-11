# 提前 flush Node 编译缓存：未采纳的诊断实验

> 原始采样、压缩数据与复算工具已移至[固定历史证据](../rust-performance-evidence.md)，不再纳入当前 PR 的文件差异。下文数字与限制保持原记录；复算前须按索引说明检出完整历史快照。

本实验没有证明提前调用 `flushCompileCache()` 能解决 TDesign 首次构建的 RSS 回退，候选生产改动已撤回。它不改变此前正式验收失败的结论，也不属于 Rust 收益。

## 对照方法

- 同一份冻结候选产物，基于 `3737c613da5822623e234b095fc51f44f141ef88` 加上 [candidate.patch](https://github.com/weapp-vite/weapp-vite/blob/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-compile-cache-flush-diagnostic/candidate.patch)；两侧 native 均关闭、Node 编译缓存均开启。
- 候选在 CLI 初始化后、首次实际 backend build 前调用一次 flush，位于原有构建计时范围内。control 通过 preload 将这一显式调用替换为空操作；flush 侧调用原 API。两侧保留 Node 原生 AtExit 持久化，完整进程退出时间也计入 wall time。
- 每个工程四对，逐对交换先后顺序。共 24 次独立 collect run、48 个构建样本。每侧 prepare 前使用空临时缓存，first/repeat 共用该侧缓存，结束后归档。
- preload 通过 `NODE_OPTIONS` 注入，两侧有相同的观测开销；只记录 CLI 主线程。每次 run 核验一个 prepare 和两个 build 进程、真实 enable 状态、缓存目录归属、prepare 零次显式 flush、每次 build 恰好一次显式 flush，以及 flush 是否转发原 API。
- 首尾冻结身份验证通过；所有配对的输入摘要、输出文件与字节摘要（含 sourcemap）、告警一致。未运行真实 IDE 或跨平台性能验收。

## 结果

下表是四对样本的 P50，仅用于筛选实验。样本量不足以推断统计显著性、稳定回退或正式通过；不能用其中任意改善单独宣布收益。

| 工程 | 阶段 | control wall (ms) | flush wall (ms) | wall 变化 | RSS P50 变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| 原生 | first | 643.678 | 653.409 | +1.51% | +1.68% |
| 原生 | repeat | 581.984 | 589.141 | +1.23% | −1.32% |
| Wevu | first | 656.580 | 667.129 | +1.61% | +22.01% |
| Wevu | repeat | 658.260 | 662.284 | +0.61% | −9.99% |
| TDesign | first | 2079.937 | 2057.709 | −1.07% | −0.14% |
| TDesign | repeat | 1408.816 | 1397.133 | −0.83% | −0.35% |

TDesign first 的 RSS P50 从 831,963,136 降到 830,808,064 字节，未消除此前约 5% 以上的风险信号。Wevu RSS 的方向随阶段变化；原生 first control 也包含较大的耗时样本，全部保留，未剔除异常值。这些结果不支持引入额外生产逻辑。

## 证据边界

[report.json](https://github.com/weapp-vite/weapp-vite/blob/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-compile-cache-flush-diagnostic/report.json) 保留全部逐次样本、CLI 观测、缓存清单、输出摘要和汇总。路径前缀已脱敏；[manifest.json](https://github.com/weapp-vite/weapp-vite/blob/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-compile-cache-flush-diagnostic/manifest.json) 同时记录原始报告 SHA-256 和公开文件 SHA-256。原始物理运行目录、完整依赖及缓存内容未随本报告发布，输出字节仅以摘要留存。本目录是诊断记录，不是能够独立重建私有冻结环境的完整采样包。

`metrics.rss` 复用配对统计数据结构，其字段名仍为 `baselineMedianMs/currentMedianMs` 等，但值的单位是字节。`exit-listener-before-native-AtExit` 观测发生在原生退出持久化之前，不能当作最终释放量；RSS 是独立进程离散采样的观测峰值，不能当作精确真实峰值。48 个样本中有 5 个 `rssSampling.status=partial`，每个均为 6 次成功、1 次不可用，分布在原生 first（3 个）和 Wevu first control（2 个）；它们全部保留，未剔除。

此前的 [正式架构测试](../2026-10-12-build-architecture-performance/README.md) 仍为未通过：TDesign 重复构建达到目标，但存在稳定 HMR 回退。本实验没有扩大 native 默认覆盖，也没有新增 changeset。
