# 默认构建架构性能：目标构建达标，整体门禁未通过

> 原始采样、压缩数据与复算工具已移至[固定历史证据](../rust-performance-evidence.md)，不再纳入当前 PR 的文件差异。下文数字与限制保持原记录；复算前须按索引说明检出完整历史快照。

本轮结论为 `regression`。TDesign 重复构建 P50 降低 **10.27%**，达到预定目标；但原生脚本首次恢复 P95 与 Wevu 模板首次编辑 P50 在首批及确认批均回退超过 5%，所以不判定全面提速，不据此扩大默认 Rust 覆盖。

两侧 **native 均关闭**，本轮测量默认 JS 编译、CLI 加载/Node 编译缓存及 HMR 准备复用的组合收益，不是 Rust 的增量收益。基线是本 PR 早期提交 `419f49d914142a591d5e109fcb3010feed66ab19`，**不是 main**；候选生产字节对应 `9163a5c9bbe402fde849ac29bc221019052ef4f1`。后续 CI 修复或源码优化不能沿用本轮数字作为自身性能证据。

## 测量与身份

每个场景首批 40 对，AB/BA 交替。首批包含三类工程构建及脚本、模板、样式、组件/路由拓扑 HMR，共 560 次侧运行、4000 个阶段样本；依据预注册规则，对原生 HMR、Wevu HMR 与 TDesign 构建执行唯一一次 40 对确认批，共 240 次侧运行、2080 个样本。合计 **800 次侧运行、6080 个阶段样本、100 项主指标**。全部样本保留，没有按最快周期选取、移除异常值或用确认批覆盖首批。

- 身份协议：`isolated-runtime-artifacts-v4`。
- 原始身份 SHA-256：`21b67aa3db4d73b6ca78535baf1ed27111c25d9502e0ebfe8f5248c8d8f3a02e`。
- 基线消费产物 digest：`86fa1ec322590573edb5088391573f448687ce3c8f4136bbbc11566db2aaabef`。
- 候选消费产物 digest：`a9c33f7d1e9e87919b1c3d82f1f417bd71d4a3dc860e282b9655967cc5689f7e`。

每侧使用独立空临时目录；先 prepare，再测新 CLI 进程首次构建和第二个新 CLI 进程的重复构建，同侧共享缓存。TSX 缓存关闭，由 CLI 自身决定 Node 编译缓存，不由驱动替代启用。npm、Rolldown、Vite 缓存的初始状态及归档清单均保留。这里的首次构建不代表操作系统冷缓存，也不是完全未执行 prepare 的启动。

HMR 保持既定 120 ms polling 与编辑/恢复顺序。构建 RSS 是进程树离散采样峰值；HMR RSS 是计时结束后 GC 的进程快照，二者不可混为峰值内存。CPU、GC、跨界及解析计数来自独立诊断，不具备完整 40 对分布。

## 首批构建结果

单位为 ms，负变化为耗时减少。

| 工程 / 阶段 | P50 基线 → 候选 | P50 变化 | P95 基线 → 候选 |
| --- | ---: | ---: | ---: |
| 原生 / 首次 | 734.588 → 659.217 | -10.26% | 774.033 → 693.805 |
| 原生 / 重复 | 739.233 → 598.241 | -19.07% | 766.901 → 623.593 |
| Wevu / 首次 | 794.964 → 662.014 | -16.72% | 834.345 → 715.870 |
| Wevu / 重复 | 798.001 → 669.536 | -16.10% | 827.250 → 699.339 |
| TDesign / 首次 | 1974.627 → 2060.657 | +4.36% | 2034.812 → 2192.608 |
| TDesign / 重复 | 1567.128 → 1406.110 | -10.27% | 1625.017 → 1449.311 |

RSS 单位为 MiB。

| 工程 / 阶段 | RSS P50 基线 → 候选 | P50 变化 | RSS P95 基线 → 候选 |
| --- | ---: | ---: | ---: |
| `build:weapp-vite-template:first:rss` | 342.99 → 314.27 | -8.38% | 350.53 → 324.44 |
| `build:weapp-vite-template:repeat:rss` | 335.63 → 313.79 | -6.51% | 347.20 → 319.83 |
| `build:weapp-vite-wevu-template:first:rss` | 365.84 → 297.29 | -18.74% | 384.31 → 365.22 |
| `build:weapp-vite-wevu-template:repeat:rss` | 380.02 → 359.14 | -5.50% | 385.59 → 364.16 |
| `build:weapp-vite-tailwindcss-tdesign-template:first:rss` | 745.52 → 793.71 | 6.46% | 781.23 → 798.63 |
| `build:weapp-vite-tailwindcss-tdesign-template:repeat:rss` | 635.41 → 626.25 | -1.44% | 681.58 → 638.53 |

## 阻止验收的稳定回退

| 场景 | 首批基线 → 候选 | 首批变化 | 确认批基线 → 候选 | 确认变化 |
| --- | ---: | ---: | ---: | ---: |
| 原生脚本首次恢复 P95 | 245.946 → 298.202 | +21.25% | 247.853 → 316.489 | +27.69% |
| Wevu 模板首次编辑 P50 | 214.213 → 240.991 | +12.50% | 215.936 → 241.908 | +12.03% |

此外有 9 项首批与确认批结论不一致，全部记为 `unstable`；不改写成通过或稳定回退。

| 指标 | 首批变化 | 确认批变化 |
| --- | ---: | ---: |
| `hmr:weapp-vite-template:native-page-script:repeat:edit:wall` | 7.59% | 0.81% |
| `hmr:weapp-vite-template:native-page-template:first:restore:wall` | 27.60% | -27.15% |
| `hmr:weapp-vite-wevu-template:vue-page-script:first:restore:wall:p95` | 8.47% | -0.22% |
| `hmr:weapp-vite-wevu-template:vue-page-script:repeat:edit:wall:p95` | 6.08% | -0.93% |
| `hmr:weapp-vite-wevu-template:vue-page-template:first:edit:wall:p95` | 7.55% | 0.49% |
| `hmr:weapp-vite-wevu-template:vue-page-template:repeat:restore:wall:p95` | 0.06% | 7.94% |
| `hmr:weapp-vite-wevu-template:vue-page-style:repeat:restore:wall:p95` | 9.91% | 0.74% |
| `build:weapp-vite-tailwindcss-tdesign-template:first:wall:p95` | 7.75% | 3.28% |
| `build:weapp-vite-tailwindcss-tdesign-template:first:rss` | 6.46% | 4.54% |

## 兼容性与证据范围

私有原采集/评估阶段的严格评估器报告 **0 项证据缺陷、0 项产物/map/告警不一致**。每轮完整产物文件集合与哈希均参与比较，构建及 HMR 各阶段的原始 source map 字节被保留并复算；该评估只规范化预先声明的已知根路径和 JSON 表达，`mappings`、`names`、`sourcesContent` 及未知来源不被抹平。CLI 告警在该阶段从保留日志重新提取。

公开 map 是规范化及隐私替换后的副本，原始私有字节仅保留 SHA-256 承诺。公开 replay 校验每阶段 map 库存、公开文件哈希，以及记录的 `normalizedMapSha256` 与产物哈希之间的一致性；不重建私有原字节，也不重新提取日志告警。告警对照结论沿用被保留的原评估结果。

完整 emitted JS 字节未由原采集器保留，因此公开包不能从原始 JS 重新计算所有产物哈希；它保留逐阶段完整文件清单、既有哈希和全部留存的 map/log。输出对照不等同于目标小程序 runtime 验收；本轮没有运行真实 DevTools、真机或跨平台性能矩阵。native 失败回退和错误语义由独立 correctness 测试覆盖，两侧 native-off 的本轮不会产生 native fallback 证据。

首次 v5 smoke 的基础设施失败保留为单独历史，不计入正式 800/6080，也不影响首批和确认批的选样。

## 公开数据与独立复算

在归档快照的仓库根目录运行：

```sh
node --import tsx docs/reports/2026-10-12-build-architecture-performance/tooling/replay.mts docs/reports/2026-10-12-build-architecture-performance
```

公开包保留全部正式样本及失败 smoke 历史。`evidence.json.gz` 保存正式样本与历史索引，以完整清单基表和差量字典减少重复；需要通过附带 codec 读取，不能直接当作原始 report schema。`blobs/` 用标准 gzip/Brotli 按内容寻址保存全部留存 map、日志、原始 JSON、身份与缓存清单的公开副本，包括失败 smoke 报告。缓存证据是原采集器记录的状态及归档文件清单，不包含 npm 或 Node 编译缓存二进制。`manifest.json.gz` 分别记录私有原件哈希和公开脱敏字节哈希；两者不是相同承诺，不能声称脱敏文件与原件逐字节一致。

复算校验完整文件集合、公开字节哈希、原件承诺的一致性、每阶段 map 库存、样本数及原评估结果；同时重建 P50/P95、门槛与唯一确认批结论。不能据此独立核验已脱敏的私有原件；没有原始 emitted JS 的限制也不会被复算工具消除。

## Rust 归因与后续范围

[此前 native 正式门禁](../2026-10-11-rust-batch-production/README.md)仍为失败：TDesign 重复构建仅降低 1.21%，路由拓扑首次编辑 P95 出现稳定回退。[当前编译入口诊断](../2026-10-11-build-startup-followup/README.md)的真实 Wevu/零售页面暖编译分别降低 7.40% / 8.60%，仅支持局部批量分析收益，小脚本及错误场景仍可能变慢。

本轮架构收益不能归入 Rust，也不能与不同冻结版本的局部百分比相加。完整 Rust script transform 的严格输出/map parity 尚未通过；native 保持可选、显式启用，Babel/Oxc fallback 与默认 JS 路径继续保留。后续候选需要新的冻结身份与同一门槛的完整配对验收，不能通过重复采样当前候选覆盖本轮失败。
