# WXML parser / serializer 性能证据

当前候选 formal-migrated-4 已通过 Node 与 Chromium 正式性能门槛，各环境 140 个受门槛约束的结果单元全部通过，cold 完整性检查也通过。迁移后相关回归及真实 Stable IDE runtime／watch 已通过，交替配对的 42 次完整构建对比满足条件。HMR 在预先固定的 v5 采样安排下，六个场景的 P50 对比均满足 1.05 条件；两侧 TDesign template 仍超过既有 500ms 绝对预算，不能宣称全部 HMR 预算达标。全部历史失败、中断及退化样本保留。

基线提交为 `b6d0577164c8ccb3b2c0e5afff702c1997297550`。语料按原始内容 SHA-256 去重，包含 464 份文档、483 个来源、398690 字节；来源与哈希保存在原始报告的 `identity.manifest`。真实语料包含 457 份微信、3 份支付宝、4 份抖音模板，语言配置覆盖不能等同于九个平台的 runtime 验收。真实语料没有 large 或实体分类输入，另设深树、长文本和实体压力分类，单独保留结果。

## 复现

安装仓库锁定依赖。首次在干净 checkout 复现时先执行 `pnpm build:pkgs`，生成三个消费者及其 workspace 依赖的 dist；后续改源码先重建受影响包，再执行：

```sh
pnpm --filter @weapp-vite/wxml build
pnpm --filter @weapp-vite/wxml bench:check
```

runner 从固定 Git 提交恢复完整语料与旧消费者的源码闭包，测量新包的 built 入口，保留全部分类、成对样本、执行顺序、批量、校准探测、P50/P95、吞吐、首次解析、模块加载、内存与包体积。正式运行需要 Node `--stack-size=4096`，包命令已配置；同等栈预算也传给 Chromium。构建、E2E 和正式采样串行，runner 持有仓库机器租约。

每个场景预热 10 对、正式 40 对，逐对交换顺序。双方使用相同工作量；耗时低于计时精度时等量扩大批次，上限 10000。Chromium 使用隔离页面，核验 COOP/COEP、`crossOriginIsolated` 和实际时钟精度。真实零值保留，不足以测量时失败。

当前 v4 契约要求 `shared` 与 `real-all` 两个真实语料聚合的候选／基线 P50 耗时比不得超过 1，其他分类不得超过 1.05，WXML 和内联脚本分类同样受此门槛约束。初次越线仅允许一次等量确认；持续越线判失败，冲突判不稳定。preserve 原文直返单独列为信息项。压力分类不能用来改变真实语料的总量或掩盖分类失败。下文旧报告保留各自运行时的契约和判定，不追溯改写。

扫描比较两侧完成同样的标签与解码属性查询任务：候选使用完整默认 `scan` API，位置、顺序、重复属性、配对和诊断的构造成本全部计时；基线通过 `htmlparser2.Parser` 的公开回调收集查询结果。此项没有宣称两侧生成完全相同的 token 数据结构。建树、canonical 序列化和编辑链路分别执行实际解析、遍历编码和属性／文本修改；原文直返的 preserve 单独列为信息项。

首两轮建树配置尚有差异：HP 使用 `decodeEntities:true`，候选 AST 保留词法原文，只在计时外校验时解码，因此旧轮建树结果不能作为统一实体配置的验收证据。后续契约将建树及冷启动统一为原文实体模式，并比较双方共同节点的 UTF-16 范围；扫描查询仍在双方计时内解码。canonical 的自然表示也不同：候选遍历原文 AST，复用文本及实体词法，仅规范标签／属性标点；HP 从已解码树遍历并重新编码。报告比较最终语义输出，不宣称内部编码工作相同。

## 最终候选：第四轮迁移后 v4 门槛通过

时间：2026-11-03 16:22:50–16:45:02 UTC。环境为 macOS arm64、Node 24.22.1、headless Chromium 156.0.8078.4、htmlparser2 12.0.0、dom-serializer 3.1.1。契约为 `wxml-paired-v4-full-real-wxml-gates`，两环境各执行八项操作、20 个语料组；核心与三个消费者 built 产物在采样前后哈希一致。源码、锁文件、运行器及完整依赖闭包的身份见原报告。

本轮在词法扫描中共享单调前进的插值游标，quoted XML 属性跳过静态跨度，并缓存缺失结束引号，避免对同一后缀反复搜索。没有改变语料、阈值、分类或唯一一次等量确认规则；前轮不稳定结果保留在下文。

下表为全部 464 份真实模板（`real-all`）的候选／基线 P50 耗时比，低于 1 表示候选耗时更低。每项独立处理完整真实语料，不混入另外 10 份压力输入。

| 操作 | Node | Chromium |
| --- | ---: | ---: |
| scan | 0.845358 | 0.834634 |
| parse | 0.597071 | 0.762595 |
| canonical | 0.375108 | 0.410352 |
| parse → edit → serialize | 0.641583 | 0.636062 |
| 构建扫描入口 | 0.437222 | 0.409308 |
| Web 编译解析入口 | 0.815000 | 0.738515 |
| simulator 模板入口 | 0.742806 | 0.769007 |

两环境各完成 160 个热路径单元、12800 条主采样：140 个硬门槛单元全部通过，无须确认；20 个 preserve 信息项完整保留。每侧均有 3792 条等价投影、15 条完整保留的 WXML 差异和零操作错误；每侧另有 20 个冷路径汇总及 1600 个样本，Node 另有 40 条 loading 记录。runner 强制验证 cold 的样本、工作量、顺序与汇总完整性。本轮退出码 0、状态 `passed`，浏览器与机器租约均正常收尾。

浏览器最小核心包为 33646 B、gzip 11429 B；基线 parser + serializer 为 68924 B、gzip 28133 B。这是最小核心依赖包的对比，内存与消费者体积的观察边界仍如上所述。

原始证据：[formal-migrated-4.json.gz](./formal-migrated-4.json.gz)。公开 gzip SHA-256：`3d8a117fb2ae3d60abd2cda797a10cb36164d2ec62abe49497931d893f4bf4de`；未脱敏 JSON SHA-256：`7dcedb6a1c0b9c52d0877add17997b65de3ca6fe49aeffd541156586318a46e5`。仅浏览器安装与临时 profile 的本机路径脱敏，全部数值、样本、差异与身份保留。

## 第二轮迁移后完整结果：v4 门槛通过

时间：2026-11-03 13:56:10–14:17:30 UTC。环境：macOS arm64、Node 24.22.1、headless Chromium 156.0.8078.4、htmlparser2 12.0.0、dom-serializer 3.1.1、Playwright 1.64.1、Babel parser 8.0.10。契约为 `wxml-paired-v4-full-real-wxml-gates`，两环境及冷路径均使用 4096 栈预算。

本轮新增独立计时的 `real-all` 聚合：按原始顺序处理全部 464 份真实文档，包含 354 份公共语法和 110 份 WXML 文档，不混入另外 10 份合成压力输入。它是第 20 个完整语料组，不能用各分类中位数相加推导。下表均为这一聚合的候选／基线 P50 耗时比。

| 全部真实语料操作 | Node | Chromium |
| --- | ---: | ---: |
| scan | 0.8524 | 0.8479 |
| parse | 0.5987 | 0.7802 |
| canonical | 0.3759 | 0.4125 |
| parse → edit → serialize | 0.6561 | 0.6121 |
| 构建扫描入口 | 0.4415 | 0.4003 |
| Web 编译解析入口 | 0.8065 | 0.6970 |
| simulator 模板入口 | 0.7335 | 0.7502 |

Node 与 Chromium 各完成 160 个热路径场景、12800 条计时样本：140 个受门槛约束的场景全部通过，20 个 preserve 信息项完整保留。两侧各有 3792 条等价投影、15 条 WXML 差异和零操作错误。WXML 差异的完整载荷仍在报告中，未删除或归一化，也不据此宣称两种语言模型完全等价。

两侧各完成 20 个冷路径分类、1600 个样本，无操作错误；Node 另保留 40 条模块加载记录。冷路径结果为信息项，但样本、顺序、工作量和汇总完整性仍是强制检查。候选浏览器最小核心包为 32505 字节、gzip 11078 字节；基线 parser + serializer 为 68924 字节、gzip 28133 字节。这不是三个消费者完整依赖包的体积比较。

本轮正式进程退出码为 0，报告状态为 `passed`；采样前后构建产物身份一致，任务资源已正常收尾。候选身份由报告中的源码、built 文件和 runner 哈希共同定义，不能仅用包含未提交变更的 Git HEAD 代表。内存观察边界与历史运行相同，不能用 runner 进程快照推断每次操作的峰值或稳定保留内存。

原始证据：[formal-migrated-2.json.gz](./formal-migrated-2.json.gz)，公开文件 SHA-256：`1e29240962112f025534ad635fe07576932884c63f0f0a9f9e11dcd410e48dc5`。未脱敏原始报告 SHA-256：`8831fcaaf14ccebb8967d85b0cbb59250a3a483f4ca52959dafd8e3b02c46c20`。公开版本仅替换浏览器可执行文件与临时 profile 的本机绝对路径；原始样本、失败历史、等价投影和身份字段完整保留，脱敏清单见 `publication`。

## 第三轮迁移后完整结果：不稳定

新增显式表达式的最终输出边界校验后，核心 536 项测试与消费者回归通过，全部相关包重新构建。本轮仍采用同一 v4 工作量与门槛，完成于 2026-11-03 15:42:38 UTC，正式进程退出码为 1，原报告状态为 `failed`。

唯一未通过项是 Node 的 `scan / real-all`：首批候选／基线 P50 比为 1.008247（3.162988 / 3.137116 ms），唯一一次等量确认比为 0.984223（3.106326 / 3.156120 ms）。两批结论冲突，判为不稳定；确认批不替换首批。其余 139 个 Node 硬门槛场景及全部 140 个 Chromium 硬门槛场景通过，没有操作错误。两环境各 20 个 preserve 信息项完整保留。

两环境各保留 20 个冷路径分类、1600 个样本，Node 另有 40 条 loading 记录。warm 断言先失败，因此主 runner 没有执行后续 cold 断言；对同一原报告独立重算样本、顺序、工作量及汇总后，cold 完整性通过。该复核不改变整轮失败结论。

原始证据：[formal-migrated-3.json.gz](./formal-migrated-3.json.gz)。未脱敏原报告 SHA-256：`876af5a35d6f988f601cb587257f3f995c03cfdaa0cbbc924ec976af60b6ff39`。脱敏范围与前轮一致。后续候选必须重新执行完整验收。

## 首轮正式结果

时间：2026-11-03 07:32:52–07:47:31 UTC。环境：macOS arm64、Node 24.22.1、headless Chromium 156.0.8078.4、htmlparser2 12.0.0、dom-serializer 3.1.1、Playwright 1.64.1。以下数字为候选／基线的 P50 耗时比，低于 1 表示候选更快。

| 真实公共语料操作 | Node | Chromium |
| --- | ---: | ---: |
| scan | 0.9192 | 0.8569 |
| parse | 0.4844 | 0.6017 |
| canonical | 0.3754 | 0.4335 |
| parse → edit → serialize | 0.7689 | 0.6970 |

Node 与 Chromium 各完成 95 个场景，均无操作错误，公共语法等价检查没有差异。Node 的 `parse-edit-serialize / stress-deep-tree-32` 初次比值 1.1391、确认比值 1.2697，判定持续退化，因此整轮失败；其余可比场景通过。两侧各保留 19 个冷启动分类、1520 个首次解析样本。无操作错误不能代替性能门槛通过。

浏览器候选包为 26476 字节、gzip 9128 字节，基线 parser + serializer 为 68924 字节、gzip 28133 字节。内存为 runner 整体进程快照，包含语料、AST、JIT 和报告，不能据此宣称每次操作的峰值或稳定保留内存；浏览器 heap 未取得，报告明确为空。

原始证据：[formal-core-1.json.gz](./formal-core-1.json.gz)，SHA-256：`c5375612e2f1c067f191a4cef9d82fcb23149d08646ce64040cc35d83572b7df`。公开版本只替换浏览器可执行文件和临时 profile 的本机绝对路径；全部测量、失败、原始样本、等价投影和源码哈希原样保留。`publication.originalSha256` 保存未脱敏原始报告哈希。

## 第二轮正式结果

时间：2026-11-03 08:15:17–08:30:17 UTC。此前增加了词法正确性回归和按需编辑容器分配，构建后 395 项核心测试、类型、lint 及公开类型测试通过。环境和采样策略与首轮相同，源码、built 文件和 runner 哈希逐项记录在本轮证据中。

| 真实公共语料操作 | Node | Chromium |
| --- | ---: | ---: |
| scan | 0.8909 | 0.9007 |
| parse（旧实体配置） | 0.5164 | 0.5734 |
| canonical | 0.3841 | 0.4216 |
| parse → edit → serialize | 0.7986 | 0.7205 |

两环境各 95 个场景，无操作错误及公共语法投影差异。唯一失败仍为 Node 的 `parse-edit-serialize / stress-deep-tree-32`：初次 1.1501，确认 1.1881；所有其他可比场景通过。这是新候选的独立完整运行，没有以重采同一候选替换旧失败。

原始证据：[formal-core-2.json.gz](./formal-core-2.json.gz)，SHA-256：`3f2e94c617520b0230ff10d0f8af61b03adb2bf14599985a9df266195fb0467a`。脱敏边界与首轮一致，全部原始样本和错误均保留。

## 第三轮正式结果

时间：2026-11-03 08:50:10–09:05:08 UTC。契约升级为 `wxml-paired-v3-raw-tree-source-edits`：建树与冷路径统一采用 raw 实体配置，共同节点比较 UTF-16 半开范围，文本修改按两侧原始源码选择。此前改用共享原型 getter 的编辑文档 class，397 项核心测试、类型、lint 与公开类型测试通过；旧报告、语料、分类和阈值保持原样。

| 真实公共语料操作 | Node | Chromium |
| --- | ---: | ---: |
| scan | 0.9759 | 0.9038 |
| parse（统一 raw 配置） | 0.5861 | 0.6469 |
| canonical | 0.3830 | 0.4150 |
| parse → edit → serialize | 0.7055 | 0.6854 |

两环境各完成 95 个场景，无操作错误及公共语法投影差异；各自保留 19 个冷启动分类与 1520 个首次解析样本。Chromium 全部可比场景通过；Node 唯一失败仍为 `parse-edit-serialize / stress-deep-tree-32`，初次 1.1077、确认 1.1300，因此迁移门槛仍未通过。

原始证据：[formal-core-3.json.gz](./formal-core-3.json.gz)，SHA-256：`33447c16debe594b6c5b4b710163da6622b8eec460edfd911752cce0abe3a358`。脱敏边界与前两轮一致。

## 第四轮中断记录

第四轮误与其他任务的 E2E 重叠，主动中断，未完成冷路径和浏览器采样。原始报告停留在 `running`，所有样本均不具备验收资格；第五轮在独立预检确认无并行验证后重新开始完整采样。

保留快照：[formal-core-4.json.gz](./formal-core-4.json.gz)，SHA-256：`0cacda5a727568fa17956a31dcf1369922d1fab0ed840042907ea0ce88221203`。公开附注明确记录中断，不修改原始样本或原始状态。

## 第五轮正式结果：核心门槛通过

时间：2026-11-03 09:37:34–09:52:06 UTC。移除编辑时逐祖先建立的 Set，改在 preserve 输出需要时按修改节点范围查询；修正带引号属性与插值中的转义层边界。431 项核心测试、类型、lint 和公开类型测试通过后重新构建。语料、阈值与 v3 工作契约保持不变。

| 真实公共语料操作 | Node | Chromium |
| --- | ---: | ---: |
| scan | 0.9645 | 0.8937 |
| parse | 0.5761 | 0.7601 |
| canonical | 0.3818 | 0.4200 |
| parse → edit → serialize | 0.6905 | 0.6888 |

两环境各完成 95 个场景，68 个可比项全部通过、27 个信息项完整保留；没有操作错误或公共语法投影差异。此前失败的 32 层编辑场景分别为 0.8174、0.8087。两侧各保留 19 个冷路径分类、1520 个样本，无冷路径错误。浏览器实际为 headless 且 `crossOriginIsolated=true`。

浏览器候选包为 28447 字节、gzip 9689 字节；基线为 68924 字节、gzip 28133 字节。内存观察边界与前轮一致。

原始证据：[formal-core-5.json.gz](./formal-core-5.json.gz)，SHA-256：`290a64f9f964b518ed04f08df022c6ce1dc9dc05fcc5440b8be02d3c5ee0e706`。脱敏边界与前轮一致。这一结果允许开始消费者迁移；迁移后的消费者链路和最终性能验收另行报告。

## 第一轮迁移后完整结果：未通过

时间：2026-11-03 11:26:48–11:48:22 UTC。新增函数／类表达式与声明的词法归属、换行和自动分号插入回归后，507 项核心测试通过并重新构建。本轮在 Node 和 Chromium 中均覆盖五项核心操作及三个生产消费入口，另外补齐冷路径样本完整性检查；语料、采样工作量和性能门槛保持不变。

| 真实公共语料操作 | Node | Chromium |
| --- | ---: | ---: |
| scan | 1.0072 | 0.9214 |
| parse | 0.7372 | 0.6973 |
| canonical | 0.3753 | 0.4175 |
| parse → edit → serialize | 0.6700 | 0.6754 |
| 构建扫描入口 | 0.4632 | 0.4332 |
| Web 编译解析入口 | 0.7575 | 0.8006 |
| simulator 模板入口 | 0.6241 | 0.6887 |

两环境各完成 152 个场景、3792 条等价投影，均无操作异常或公共语法差异。Node 的 `scan / shared` 首批为 1.0072，唯一一次等量确认结果为 0.9804，两次结论冲突，按约定判为“不稳定”，整轮未通过。Node 其余 118 个可比项通过；Chromium 的 119 个可比项全部通过。双方各 33 个信息项完整保留。

两侧各有 19 个冷路径分类、1520 个样本和零错误；独立完整性重检核对样本、顺序、工作量和重算汇总通过，没有修改整轮失败状态。候选浏览器核心包为 31272 字节、gzip 10607 字节。浏览器消费者使用真实锁定 Babel parser 及已记录的模块传输适配，冷路径仍仅测核心首次解析；详细边界见 runner 文档和原始报告。

15 条 WXML 信息性差异完整保留，其中两条 simulator 差异来自旧实现向注释里的 `<wxs>` 泄漏占位符；新实现保留原注释。对应 Node 双 provider 与实际浏览器回归均覆盖注释中的外部与内联脚本不注册、不加载、不执行。基准投影未为此删除或归一化注释。

原始证据：[formal-migrated-1.json.gz](./formal-migrated-1.json.gz)，SHA-256：`04cb6f69d5a04dff7b8e9caeccc1349a9a66aeeeb4c76b13988376879e42fb87`。脱敏边界与前轮一致。本轮失败证据保留，后续优化必须形成新的完整候选结果。

## 真实 IDE 编码失败与最终复验

后续实际 Stable `2.02.2609240`、基础库 `3.17.2` 验证在页面就绪前两次超时，两次均未执行用例断言。第二次通过原生界面检查确认，模拟器显示生成的 WXML 属性表达式编译失败：`unexpected attribute name`。页面协议的 `getPageMetaByWebviewId` / `rawPath` 异常发生在编译失败之后，不能将其归为已证明的 IDE 环境故障。

生成端仅转义外层引号，未为 JavaScript 已有的反斜杠编码完整宿主属性层；共享解码器随后按同一假设反解，Web 和 simulator 的回归因此形成内部自洽，未暴露宿主拒绝的字节。这是修复前的历史失败，后续最终复验结果见下文；先前 headless 与浏览器通过不能替代真实宿主验收。每次失败后的任务窗口、安装进程、端口与租约均按登记归属正常收尾，未改版或清理用户缓存。含本机路径和账号标识的原生日志仅保留在本地诊断目录，不随公开报告发布。

同一安装的官方 WXML 编译器进一步确认：quoted legacy 属性需要先编码全部反斜杠，再转义外层引号；仅转义引号或直接写入同种引号都不合法。核心按完整宿主属性层统一解析、解码和序列化，保留原始 UTF-16 范围；XML、无引号属性和文本仍分别处理。绑定内部实体样字符串保持原文，实体解码只应用于对应静态层。

之后的一轮诊断已成功启动原生与 Vue 页面，并执行两项用例。完整属性观测见 [runtime-encoding-observations.json](./runtime-encoding-observations.json)：WXML 字符串中的转义引号实际保留为 `\x27` / `\x22` 字面文本，而非标准 JavaScript 的引号值。两项用例按旧预期失败，fixture 另误用了 WXS 不提供的裸 `exports`；该 JSON 的原始失败状态继续保留。

最终复验仍使用 Stable `2.02.2609240`、实际基础库 `3.17.2`，运行前官方 Stable 查询与所选安装一致。`e2e/ide/wxml-transform.runtime.test.ts` 的两项用例、`e2e/ide/wxml-transform-watch.runtime.test.ts` 的两项用例均通过，两个进程退出码均为 0；任务窗口、宿主及登记资源已正常收尾。最终通过覆盖修正后的完整属性编码、原生与 Vue 页面，以及 watch 更新后的实际 runtime 结果，不覆盖或改写前述失败证据。

simulator 的 WXML 字符串字面量求值以真实宿主观测到的 `\x27` / `\x22` 行为为依据。WXS fixture 改用 `module.exports`；WXS 求值、来自 `page.data` 的值及 Web 既有标准 JavaScript 表达式语义仍遵守各自契约，不做全局字符串补偿。解析核心负责宿主属性词法层、源码范围和 preserve／编辑，不承担消费者的表达式执行语义。

## 迁移后回归摘要

以下验证均在重建相关包和下游产物后执行，退出码均为 0。表中数字为本轮完整日志统计；Web 的一项既有 skip 如实保留。

| 验证范围 | 结果 |
| --- | --- |
| 语言服务相关测试 | 11 文件，248 通过 |
| 构建相关定向测试 | 25 文件，337 通过 |
| Web 完整 Node 测试 | 147 文件，1137 通过，1 项既有 skip |
| simulator 完整 Node 测试 | 142 文件，1090 通过 |
| Web 包级 typecheck / 公开类型测试 | 均通过 |
| headless runtime | 2 文件，4 通过 |
| simulator 浏览器回归 | 4 文件，45 通过 |
| Web 浏览器回归 | 2 文件，4 通过 |
| 多平台构建回归 | 3 文件，26 通过 |
| 真实 Stable IDE runtime / watch | 各 1 文件、2 通过 |

核心另通过 15 文件、544 项单测，以及包级 typecheck、lint、公开 tsd。HMR 测量工具通过 122 项回归，覆盖完整产物、恢复、完成日志屏障、事件辅助观察与定向资源释放。相关完整构建与 HMR 性能证据另列如下。

## 下游完整构建与 HMR 证据

本节的 TDesign、native、Wevu 分别指 `weapp-vite-tailwindcss-tdesign-template`、`weapp-vite-template`、`weapp-vite-wevu-template`。比值均为 candidate / baseline 的 P50 耗时；完整构建对比条件为 ≤1.05，HMR 另保留 wall 对比与既有 500ms 预算，不能用完整构建或 parser 基准代替。

### 完整构建：交替配对 v3 达标，旧退化保留

v3 每模板 7 对，共 42 次构建；全局奇数对 baseline → candidate，偶数对反向，无 warmup、丢弃或替换样本。运行状态 `comparison-met`、`trusted: true`、exit 0，前后身份漂移为 `[]`，三套模板输入哈希相同；每次构建另保留完整 dist 文件清单。

| 模板 | baseline P50 ms | candidate P50 ms | v3 比值 |
| --- | ---: | ---: | ---: |
| TDesign | 2101.975 | 2128.689 | 1.012709 |
| native | 877.633 | 855.030 | 0.974246 |
| Wevu | 928.709 | 902.092 | 0.971339 |

v1/v2 各侧均完成 21 次构建并 exit 0，但旧 runner 只检查构建与产物，没有执行性能门禁。两轮按 checkout 分块：v1 先 baseline，v2 先 candidate。v2 的三个比值均超过 1.05，21 个同序号 candidate 样本全部更慢；缺少 CPU 频率、温度等因果证据，不能将其改写为已证明的机器噪声。

| 模板 | v1 baseline / candidate ms | v1 比值 | v2 baseline / candidate ms | v2 比值 |
| --- | ---: | ---: | ---: | ---: |
| TDesign | 2208.224 / 2260.444 | 1.023648 | 2130.506 / 2845.464 | 1.335581 |
| native | 910.528 / 938.156 | 1.030342 | 877.487 / 1079.267 | 1.229953 |
| Wevu | 961.217 / 978.763 | 1.018253 | 935.876 / 1127.132 | 1.204361 |

证据：[v1 baseline](./related-build-baseline.json.gz) / [candidate](./related-build-candidate.json.gz)、[v2 baseline](./related-build-baseline-v2.json.gz) / [candidate](./related-build-candidate-v2.json.gz)、[v3 配对完整归档](./related-build-paired-v3.json.gz)。旧轮页面 JS/WXML 哈希相同只证明被校验页面一致，不代表样式、JSON、共享 chunk 等全部产物逐字节一致。

### HMR：四轮结果与未通过项

每轮两侧各有 6 场景 × 20 个 edit 样本，classic、edit-only、profile 关闭，均无场景运行错误且身份漂移为 `[]`；恢复观测另行保留。v1 只等待目标 marker；v2/v3 在 marker 后等待既有重建完成日志，再 GC/restore。v4 增加父目录事件辅助读取并保留 25ms 轮询兜底，计时仍为源码替换到 marker 可见，前轮结果没有按新工具重算。

| 模板 / 场景 | v1 wall 比值 | v2 wall 比值 | v3 wall 比值 | v4 wall 比值 | v4 CLI 比值 |
| --- | ---: | ---: | ---: | ---: | ---: |
| TDesign template | 1.254527 | 0.982798 | 0.963310 | 0.962564 | 0.948423 |
| TDesign style | 1.334641 | 1.039572 | 1.065971 | 1.048068 | 0.942205 |
| native template | 0.995657 | 1.087022 | 1.087270 | **1.050970** | 0.959330 |
| native style | 0.999128 | 1.077474 | 1.006589 | 0.982469 | 0.950038 |
| Wevu template | 1.004715 | 1.000169 | 0.998414 | 1.000338 | 0.964277 |
| Wevu style | 0.923857 | 1.003792 | 0.994543 | 0.995711 | 0.955314 |

预算按各场景实际最大 edit wall 判断。八个 HMR 进程均为 exit 1，以下 baseline / candidate 状态与最大值完整保留：

| 轮次与原始归档 | exit | 超预算场景数 | 最大 wall ms |
| --- | --- | --- | ---: |
| v1 [baseline](./related-hmr-baseline.json.gz) / [candidate](./related-hmr-candidate.json.gz) | 1 / 1 | 1 / 2 | 752.923 / 1277.753 |
| v2 [baseline](./related-hmr-baseline-v2.json.gz) / [candidate](./related-hmr-candidate-v2.json.gz) | 1 / 1 | 1 / 3 | 687.342 / 789.157 |
| v3 [baseline](./related-hmr-baseline-v3.json.gz) / [candidate](./related-hmr-candidate-v3.json.gz) | 1 / 1 | 1 / 1 | 767.936 / 678.717 |
| v4 [baseline](./related-hmr-baseline-v4.json.gz) / [candidate](./related-hmr-candidate-v4.json.gz) | 1 / 1 | 1 / 1 | 676.620 / 662.435 |

v4 两侧唯一预算失败均为 TDesign template，wall P50 为 649.540 / 625.224ms。native template 的 286.841 / 301.461ms 对应精确比值 1.050970236766，仍大于 1.05，不能四舍五入为达标。v3 的 TDesign style 与 native template 也仍是已记录的对比退化。

v4 六个 CLI 自报重建耗时 P50 均更低，但 CLI 与源码替换到产物可读的 wall 起止不同，不能用它替换 wall 或宣布 HMR 门槛通过。两侧 edit/restore 输入哈希一致；profile 关闭时的证据也不足以单独归因或排除 parser。v2 的长尾同样保留，例如 candidate native template 第 16/17 次 wall 约 632/760ms、CLI 约 540/656ms，不能仅凭 P50 忽略。

### 最终 HMR v5：对比条件满足，绝对预算仍有失败

v4 剩余差异触发独立阶段诊断，而非删除样本。两个 [native-phase](./native-phase-baseline-1.json.gz) [诊断归档](./native-phase-candidate-1.json.gz) 各为 profile 开启、两场景各 5 次编辑，仅用于定位。native template 的 matched source-to-watcher P50 为 baseline 46.055 / candidate 66.804ms，内部 total 为 237.715 / 212.683ms；这证明该诊断中外部等待增加，不能追溯证明 v4 差异的唯一原因。

输入 watcher 的固定轮询为 120ms，原有采样在完整 edit/restore、GC 后固定等待 300ms。v5 在采样前固定 seed `wxml-20261103-phase-v1`，为每个场景的 20 次编辑安排 `[3, 9, …, 117]`ms 的确定性乱序等待，按 seed、template、scenario 独立生成，两侧逐序相同；等待在原 wall 起点之前。算法、offset、实际等待与 wall 起点时间戳均写入原报告。原有 300ms settle、20 次 edit 与 restore、完整产物校验、完成屏障、profile 关闭和 500ms 预算均保留。

这项安排覆盖的是额外等待的分层，不能证明真实 watcher 相位已经均匀；它还增加平均 60ms 的计时外冷却。v5 是明确的新采样版本，不能把跨轮改善全部归因于相位调整，也不能覆盖旧轮。seed 没有按结果调整或补采。

| 场景 | baseline P50 ms | candidate P50 ms | wall P50 比值 | wall P95 比值 | CLI P50 比值 |
| --- | ---: | ---: | ---: | ---: | ---: |
| TDesign template | 623.646 | 573.518 | 0.919620 | 0.969150 | 0.969226 |
| TDesign style | 375.705 | 360.366 | 0.959173 | 0.939888 | 0.938235 |
| native template | 323.433 | 295.354 | 0.913183 | 0.981874 | 0.951275 |
| native style | 320.882 | 287.892 | 0.897189 | 0.971271 | 0.958517 |
| Wevu template | 286.812 | 286.717 | 0.999669 | 0.958544 | 0.966190 |
| Wevu style | 286.596 | 275.422 | 0.961012 | 0.957441 | 0.953143 |

两侧各完成 120 个 edit 和 120 个 restore，所有输入 SHA-256 及相位 offset 逐序一致，每个场景恰好覆盖全部 20 个分层；六份日志均严格完成 80 次 completion/inspector attach/ending。前后身份无漂移，无运行错误。本轮六项 wall P50 比值均严格不超过 1.05，支持此采样范围内没有相对性能退化的结论。

两侧仍各有一个 TDesign template 预算失败，20/20 edit wall 均超过 500ms；最大值为 baseline 655.263 / candidate 647.309ms，两个子进程都保留 exit 1。P50 对比满足不等于绝对预算满足。完整证据：[v5 baseline](./related-hmr-baseline-v5.json.gz) / [candidate](./related-hmr-candidate-v5.json.gz)。

正式 parser 采样后，核心仅新增一条说明公开兼容入口委托顺序的 ESLint 注释；再次原生构建的 `index.mjs` SHA-256 仍为 `eaceb441a575fb5462ba3809df6d84655941ab16d13b4866db129c579bceb203`，与 formal-migrated-4 相同。最终源码包含这条注释差异，不把最终源码哈希冒充采样时源码哈希。消费者运行时代码未再改变。

### 原始证据与复现边界

[公开清单](./related-performance-manifest.json) 记录全部 17 份 related gzip（含两份仅诊断记录）、原始文件与公开归档哈希、退出码、预算及脱敏规则。归档保留 1346 个主样本、恢复观测、身份与日志；仅本机路径、PID、调试端点等元数据脱敏，耗时、内存、状态及失败样本不变。归档主报告位于 `files['report.json'].content`；嵌入的原始文件哈希仍指向脱敏前字节。

[配对构建脚本](./run-build-paired.ts.txt)、[v4 HMR wrapper](./run-related-v2.ts.txt)与 [v5 HMR wrapper](./run-related-v5.ts.txt) 是发布时源码快照。还原到下列原路径后，从候选仓库根运行；依赖相对导入与 wrapper 自哈希，不能直接从 `.txt` 位置执行：

```sh
mkdir -p .tmp/current-run/wxml
cp docs/reports/2026-11-03-wxml-parser/run-build-paired.ts.txt .tmp/current-run/wxml/run-build-paired.ts
cp docs/reports/2026-11-03-wxml-parser/run-related-v2.ts.txt .tmp/current-run/wxml/run-related-v2.ts
cp docs/reports/2026-11-03-wxml-parser/run-related-v5.ts.txt .tmp/current-run/wxml/run-related-v5.ts
```

历史环境为 Node 24.22.1、pnpm 12.16.1、macOS arm64 / Apple M4 Max。分别按两侧冻结 lockfile 安装并构建各自 packages，使用同一 Node/PATH；清除继承的 `NODE_OPTIONS`、`NODE_V8_COVERAGE`、CLI 与无关 HMR overrides，保留机器串行租约并防止系统休眠。将 `BASELINE_CHECKOUT` 设为基线目录，输出目录须为新目录，依次执行并完成各次清理：

```sh
node --import tsx .tmp/current-run/wxml/run-build-paired.ts "$BASELINE_CHECKOUT" . .tmp/current-run/wxml/replay-paired-build
node --import tsx .tmp/current-run/wxml/run-related-v5.ts hmr . .tmp/current-run/wxml/replay-candidate-hmr-v5
node --import tsx .tmp/current-run/wxml/run-related-v5.ts hmr "$BASELINE_CHECKOUT" .tmp/current-run/wxml/replay-baseline-hmr-v5
```

基线必须为干净的 `b6d0577164c8ccb3b2c0e5afff702c1997297550`。配对 wrapper 有意拒绝干净 candidate checkout，且要求两侧模板输入相同；重放须重建记录中的 dirty candidate、源码/dist/runner 身份，不能删除断言后声称原样复现。最终 HMR wrapper 也不等于 v1/v2/v3 的历史依赖图。HMR 按 checkout 分块，`plan` 仅规划，旧 `build` 模式为顺序 21 次构建，均不同于 v3 的 42 次交替配对。

### 文件拆分评估

新增 parser、benchmark 与消费者源码均不超过 300 行。既有 Web plugin 协调文件为 647 行，本次仅接入输入选项，保留原插件阶段与生命周期归属，新增逻辑另置 helper。既有 HMR runner 超过 300 行，本次屏障、事件辅助观察与采样安排继续共用采样、恢复及 teardown 的单一协调流程；cleanup 测试为 355 行，保留同文件以共用模拟进程、文件系统及收尾 fixture，避免另建资源生命周期。
