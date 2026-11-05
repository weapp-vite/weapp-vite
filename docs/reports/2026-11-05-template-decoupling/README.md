# 模板平台解耦：验收检查点与失败证据

本轮正式性能尚未验收。相对冻结 main 的回归已经观察到经等量确认的退化和不稳定结果；两次正式尝试均未形成可接受的完整结果。本页保留这些原始证据，不将局部收益、诊断采样或历史通过结果作为本轮完成依据。

架构目标是将模板事实收敛至 `@weapp-vite/wxml/presets`，由平台无关 `/core` 复用编译方言及解析上下文；根入口保留兼容参数，shared、语言服务、构建扫描、Web 与 simulator 消费同一词法核心。九平台语言预设不扩大六平台构建白名单或宿主 runtime 的支持范围。

## 身份与两套基线

相对 main 的比较基线为 `739da6b848a47ac44cb567ce643b97ff79da9cc4`，原锁 SHA-256 为 `045a5e5768c86c98bf1220bd469091d518cd07c1e85bc3de0c3b87bbc487c99c`，冻结源码清单 SHA-256 为 `6050a47e22887ab233f3349f898486c49fcb0af20b9b483e001f45e6bbe0c78c`。采样前从该提交冻结源码，再使用其配置构建基线；消费者闭包指向冻结源码，避免通过当前 workspace 软链接混入候选实现。

`regression-003` 的候选 HEAD 为 `2c8f0f756336ea00863ff6eacaa0197fe1c5289c`，同时包含未提交的本轮修改，不能仅用 HEAD 还原候选。完整候选源码清单 SHA-256 为 `248ceb562a6108746bc71dce57dba52903eed39a5b41ad2225afcf2259e3562a`；根 built 入口 SHA-256 为 `ba41f700a8f7cf5850961953e462180e1eabe1f743ad87b4e3ece0f5a303c172`。完整源码、锁、built 入口、传递 chunk、工具和消费者身份见[候选身份提取件](./regression-003.identity.json.gz)及两轮各自的冻结源码清单。

| 比较 | 分母与门槛 | 本轮状态 |
| --- | --- | --- |
| 冻结 main → 本轮完整根入口及消费者 | 保留旧 464 份及全平台合法 profile 分组；整体 P50 比例 ≤1.03、单类 ≤1.05；Node、Chromium 各 10 对预热及 40 对正式采样，越线仅一次等量确认 | 未通过；失败与中断证据如下 |
| htmlparser2 / dom-serializer → 本轮候选 | 原 464 份、二十组与独立策略不变；不得改用新语料或绑定 core 的收益代替 | 当前优化候选尚待正式重跑；不沿用历史结果 |

[2026-11-03 报告](../2026-11-03-wxml-parser/README.md)保留旧实现、历史策略及其独立验收结果。本页不会改写其样本，也不会将不同基线的结论合并。`preserve-noop`、模块加载、初始化、内存与包体积是独立观察，不能替代完整解析、完整序列化或消费者门槛。

冻结语料为 `all-platform-v1`，manifest SHA-256 为 `085d532ec20ba7e534ecf279600c4130b9a49eb9ab6da6139cf3f4335fde11a1`，内容 SHA-256 为 `1fe0bf88acffcbb1972b9b91b2596ec073e678f5f6a5efb6d423a3bfb5e516fb`。其中有 13,558 份全局内容去重真实模板、26,228 个来源成员、7,075 份具有真实非微信来源的唯一模板。跨平台成员数与全局唯一数分开统计，不能相加作为真实模板总量。

## 正式尝试 regression-001：中断且缺运行时原始样本

该尝试在前 16 格中观察到 `old464/shared`、`old464/shared-small` 的 parse、parse-edit-serialize 及构建扫描退化后，以 SIGINT 结束，退出码 130。独立[中断记录](./regression-001.interruption.json.gz)与[标准输出](./regression-001.log.gz)保留了当时结论。

这轮发生在逐格 checkpoint 实现之前。[原主报告](./regression-001.report.json.gz)仍记录 `running`，只有准备身份、分组与输入清单，没有落盘的运行时原始样本。因此不能重算这些格子的完整成对判定，也不能验收。未执行 Chromium 和完整三入口研究，不拼接后续运行补齐。

基线源码完整身份保留于 [regression-001 baseline identity](./regression-001.baseline-source-identity.json.gz)。该轮失败不因后续 runner 补齐 checkpoint 能力而追溯变成有效完成。

## 正式尝试 regression-003：确认退化、浏览器中断及主报告截断

该轮配置为 Node 与 Chromium 完整矩阵，每侧 845 格、10 对预热、40 对正式采样；出现越线时按同等批量执行一次 40 对确认。以下是原始逐格流中保留的 summary 状态，不是整轮通过判定：

| 运行时 | 已完成 / 计划格数 | 原始行数 | complete | regression | unstable | checkpoint |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Node | 845 / 845 | 847 | 762 | 76 | 7 | complete |
| Chromium | 280 / 845 | 281 | 161 | 117 | 2 | interrupted / SIGINT |

Node 流含完整 start、845 个 cell 和 complete 记录；Chromium 流含 start 与中断前 280 个 cell，没有 complete 记录。归档时独立逐行核对了连续序号、previous/payload/envelope SHA-256、cell 顺序号、文件字节数及 checkpoint 链尾；Node 完整流的 SHA-256 也与其 checkpoint 相符。该检查只证明已保存证据未被截断或替换，不把 `regression`、`unstable` 或缺失格子改成通过。

例如 `old464/shared` 聚合保留了下列候选／基线 P50 比例，确认结果不替换首批样本：

| 运行时 | 操作 | 首批比例 | 唯一确认比例 | 原 summary 状态 |
| --- | --- | ---: | ---: | --- |
| Node | parse → edit → serialize | 1.103122 | 1.135210 | regression |
| Chromium | scan | 1.090239 | 1.079268 | regression |
| Chromium | parse | 1.242956 | 1.240273 | regression |
| Chromium | parse → edit → serialize | 1.166471 | 1.151176 | regression |

两环境已保存的正式及确认样本分别为 74,240 条和 31,920 条；预热样本分别为 16,900 条和 5,600 条。全部采样、校准、parity 与失败 summary 均保留，不从公开证据中删去失败分类。

原主报告只写入 8,912,896 字节，JSON 在 position 8,912,464 处截断，无法解析。[截断原文](./regression-003.report.truncated.json.gz)按原字节压缩，没有补齐闭合符或合成最终状态。[身份提取件](./regression-003.identity.json.gz)只从截断位置之前完整存在的 `identity` JSON 值导出，并单独记录原报告哈希；它不是修复后的主报告。退出后的最终汇总、完整 Chromium 矩阵、三入口研究及全程末尾身份复核均不足以验收。

原始证据：

- [Node 增量流](./regression-003.node-cells.ndjson.gz)与 [Node checkpoint](./regression-003.node-checkpoint.json.gz)。
- [Chromium 增量流](./regression-003.chromium-cells.ndjson.gz)与 [Chromium checkpoint](./regression-003.chromium-checkpoint.json.gz)。
- [完整标准输出](./regression-003.log.gz)、[基线源码清单](./regression-003.baseline-source-identity.json.gz)、[候选身份提取件](./regression-003.identity.json.gz)。

## 后续诊断的边界

[diagnostic-003 摘要](./diagnostic-003.summary.json.gz)保留该次诊断的受测源码和 built 哈希、原报告承诺、选定分组及汇总。它只运行 `old464/shared`、4 对预热及 12 对正式采样，属于定位证据；即使个别操作落在预算内，也不能证明完整矩阵或正式预算通过。摘要不保留或冒充完整正式报告，其后源码优化不沿用该次身份。

后续 factory、扫描输出容器和编辑上下文性能修改正在验证。本页以下正确性检查点先于这些修改，不能直接作为最终工作树的复验回执。最终候选需要补齐受影响检查、完整双运行时回归和原 htmlparser2 正式门槛；新的证据应另增归档，不覆盖本页历史失败。

## factory 性能修改前的正确性与宿主检查点

[检查点归档](./correctness-before-factory.json.gz)同时保存生产源码覆盖原始命中、receipt、逐文件 verdict、root/core 源码语料与 fuzz 报告、四份 built 报告及定向验证日志。各文件位于 `files[原相对文件名].content`，原文件哈希和脱敏位置位于 `publication.originalFiles`。

| 范围 | 已观察结果 | 可证明的边界 |
| --- | --- | --- |
| WXML unit 与源码覆盖 | 22 文件、640 tests；32 个生产文件进入分母，无 ignored/missing/unexpected | 语句 1,297/1,297、函数 153/153、行 1,259/1,259 均为 100%；分支 1,210/1,217（99.42%） |
| built root/core × Node/Chromium | 四份独立报告均 `accepted: true`，每份 14,584 个语料用例；公共 manifest/dist 身份不变 | 两种入口都完成语料、语法、presets/入口契约及固定种子预算 |
| 固定种子组合 | 每份 built 报告各完成 100,000 个合法组合、100,000 个明确非法变异、10,000 条八步编辑序列 | 有限冻结预算通过，不表示穷尽所有输入 |
| 模板宿主场景 | 同一两个模板场景先 headless、后 Stable IDE，各 2 tests 通过 | 真实 Stable 2.02.2609240、基础库 3.17.2；IDE 正常退出，未保留本任务 UI 资源 |
| Web 与 simulator 浏览器 | Web 2 文件 / 12 tests；simulator 6 文件 / 12 tests 通过 | 定向浏览器交互与模板契约，不扩大其他宿主支持 |
| 六平台构建及原生脚本/HMR | 4 文件 / 15 tests 通过 | 验证的是构建与既定 HMR 场景，不等同于六个真实宿主 runtime |

覆盖率原始文件中的本机源码路径已替换为 `<repository>`，命中数与生产文件清单不变。宿主日志仅替换 checkout/安装路径、PID 与 loopback 端点，版本、顺序、测试结果和退出观察保留。完整脱敏列表与原始哈希可在检查点归档中逐项核对。

全局 built 聚合仍为 `accepted: false`：inventory 继承 Taro 4.3.2 Harmony JSUI 开发、生产两个构建失败。MPX 历史安装日志的原始 1,302 字节附件仍缺失，单独继承。解析、fuzz、覆盖率与宿主两个场景通过，均不能代替这些框架完整性门槛，也不能把整轮交付写为完成。

## 归档格式、隐私与核验

[公开清单](./publication-manifest.json)记录每个压缩文件的原始字节 SHA-256、公开解压内容 SHA-256、公开 gzip SHA-256、大小与脱敏边界。gzip 使用 mtime=0、空 filename；NDJSON、两份主报告、checkpoint、日志和基线源码清单没有本机路径时保留原字节，`redactions: []`。原始和公开内容哈希相同的条目可以直接核对，公开 gzip 哈希只验证压缩文件。

`correctness-before-factory.json.gz` 是带 `publication` 的多文件公开归档；`diagnostic-003.summary.json.gz` 和 `regression-003.identity.json.gz` 是明确标记的派生件。其清单哈希指向派生内容，生产者原始文件的承诺另外记录，不能混为同一文件。原报告和 receipt 内嵌的原文件哈希继续指向脱敏前字节，不用公开副本重新伪造这些身份。

可以从仓库根目录独立核对所有公开压缩文件与解压内容，不需要启动浏览器或执行 benchmark：

```js
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

const directory = 'docs/reports/2026-11-05-template-decoupling'
const manifest = JSON.parse(await readFile(`${directory}/publication-manifest.json`, 'utf8'))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
for (const entry of manifest.archives) {
  const compressed = await readFile(`${directory}/${entry.archive}`)
  assert.equal(sha256(compressed), entry.publicArchiveSha256)
  const content = gunzipSync(compressed)
  assert.equal(sha256(content), entry.publicContentSha256)
  assert.equal(content.length, entry.publicContentBytes)
}
```

正式复验命令、冻结步骤、独立消费者闭包与一次等量确认规则见[回归基准维护说明](../../../scripts/templateCorpus/benchmark/README.md)；旧 htmlparser2 复验入口见[原 benchmark 说明](../../../scripts/benchmarkWxmlParser/README.md)。运行时须先重建受影响包，构建、覆盖率、E2E 和性能采样串行，每次使用新输出目录，不将旧样本拼成新运行。

## 测试提速与本轮交付边界

用户追加要求减少重复测试，优先提交和推送已实现代码。本轮提交范围与最终验收状态分别记录：架构、消费者适配和测试工具可以形成可审查提交，但不因此把尚未完成的性能门槛、最终候选复验或继承缺口改为通过；本轮不发布版本。

当前提速工作包括日常回归默认 quick、完全相同计时工作量去重，以及 root/core 的 built 验收合并准备。计时复用必须同时匹配操作、两侧入口、完整有序输入/profile 和预算；不同工作量继续独立采样，全部原分类和各自阈值保留。相同物理采样映射到多个分类时，公开映射和原始样本承诺，不复制样本冒充多次独立运行。合并正确性准备也不得用 Node 结果替代 Chromium、或用 root 结果替代 core。

提速实现已完成：日常 `bench:regression` 默认 3 个代表组、2 次预热和 5 对样本，不执行三入口研究；完整入口为 `bench:regression:check`。`exact-workload-v2` 在相同实现、运行时、操作、有序输入与配置、预算和阈值一致时复用物理任务。冻结 inventory 的 845 个逻辑分类对应 603 个物理任务，避免 242 次重复测量（28.6%）；两运行时分别生成计划，不跨运行复用。该比例描述任务数量，尚未运行新协议完整矩阵测定墙钟提速。

CI 改用 `test:acceptance` 合并语料与 fuzz，Node 阶段和 Chromium 启动分别从四次减少为两次；root/core × Node/Chromium 的实际用例和 fuzz 预算不减。源码覆盖率仍独立执行；完整覆盖率本身包含包内单测，构建后类型验证使用 `test:types:check` 避免重复构建。

工具 TypeScript、ESLint 与相关回归已通过，包括真实校准回放、原始样本不复制、引用篡改、输入变更、旧 v1 协议及 UTF-16 身份。首次新增校准测试的 mock 错误被独立验证拒绝，修正后重跑通过。工作量编码改为只在顶层执行一次稳定 JSON 编码，回归约束嵌套大小，避免重复转义放大。

用户要求优先提交推送，本轮不再执行完整性能矩阵。最新包内 645 项单测、类型与构建已通过；额外完整源码覆盖率复跑因耗时在本任务精确中断，保留中断日志，不记为通过。完整 built 验收不沿用为最终候选的新回执。正式 main 回归仍保留 10 对预热、40 对正式采样、唯一一次等量确认与原门槛；原始主样本物理执行数减少，分类通过状态不可作为多次独立采样。quick、诊断和部分执行均不能获得正式通过状态。

[测试提速检查点](./test-speed-validation.json.gz)保留 inventory-only 计划数量、工具检查及修复回执、组合 CI 入口契约、包内检查和中断日志。另用四份旧真实语料验证 built Node 的去重链路：4 个逻辑结论对应 2 个物理任务，20 条主采样记录，外部完整性与逐行 checkpoint 均通过，总耗时约 1.9 秒。这是工具集成 smoke，未执行 Chromium，不是产品性能或完整语料验收。inventory-only 计划使用来源身份占位核对数量，不能冒充完整实际源码绑定的正式计划。

## 最终候选待补

仍需补齐 factory 性能修改后的相关正确性/类型/覆盖回执、Node 与 Chromium 完整 main 回归、core-entry profile、原 htmlparser2 正式复验，以及最终源码与构建产物身份。主代理在本目录另增最终运行证据和结论；本页已有失败归档保持不可变。
