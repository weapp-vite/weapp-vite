# Native 恢复归因：编译更快，回调等待与驱动时机仍影响 wall

本轮没有证明或消除正式性能回退。原生脚本首次恢复的四对样本中，候选 bundler 每对都更快，但 wall 有三对增加、一对减少；主要差异需要结合写入到 watcher callback 的等待解释。带 profile 的驱动还改变了部分恢复写入时机，不能将剩余耗时统称为纯 polling，更不能据此宣称 Rust 或全项目提速。

这是固定 v10 产物上的独立插桩诊断，两侧 native 均关闭。基线仍是本 PR 早期 `419f49d914142a591d5e109fcb3010feed66ab19`，不是当前 main。v10 不含随后 Vue 配置同内容 mtime 的兼容修订；本轮 Native script/template/style 不执行 Vue 配置提取。旧正式验收失败及其门槛保持有效。

## 固定范围和完整性

四对 AB/BA 交替，8 次串行运行。每次按原 template/script/style 顺序各执行两轮 edit/restore，共 **96 个阶段样本**；全部保留，没有按耗时选择或补跑个别样本。驱动观察覆盖三类真实源文件 `index.wxml`、`index.ts`、`index.scss`；watcher/read 的单目标观察只覆盖脚本，合计 **32 个 callback 窗口**。

保留原子保存、120 ms watcher polling、25 ms output polling、300 ms settle，以及原 await、return、错误和清理顺序。profile 在这轮诊断中明确开启；此前 v10 冒烟关闭 profile，两者不是同一测量条件。每条观测同步采集 CPU、ELU、内存并缓存在进程内，正常退出时刷写，存在额外开销。

8 次运行均有一条 prepare 成功消息、12 次重新构建日志和12个不同 buildId 的原始 profile。全部96条 profile 各含一个 source event；在这个观察范围内未见重复构建，`queueWaitMs` 最大为 **1.257 ms**，不支持用长队列解释百毫秒差异。全部32个脚本窗口各关联一个 callback、一个 client hook 和一次 read；没有丢失记录或观测错误。driver 退出0，CLI沿用受管 SIGTERM teardown退出143，目标 watcher 已注销。

采集器对48对同阶段样本核对了全部96份输入、完整产物清单/摘要、maps及其采集的告警字段。该告警字段仅来自dev.log，不能冒充prepare完整覆盖。本公开包另外保留全部8组collector（包含prepare）与dev日志：prepare均成功，dev每次都有26条相同的codeSplitting debugName提示；`warnings: []` 不表示日志没有提示。V1首侧的对应日志亦保留。

## 脚本首次恢复：逐对结果

单位为ms。pair使用原报告的0–3编号；“开始→callback”包含保存、polling等待及事件循环交付。

| pair | wall：基线 → 候选 | 开始→callback：基线 → 候选 | bundler：基线 → 候选 | bundler差值（候选−基线） |
| --- | ---: | ---: | ---: | ---: |
| 0 | 239.425 → 239.721 | 17.056 → 25.651 | 193.974 → 175.900 | -18.074 |
| 1 | 346.813 → 214.158 | 89.631 → 8.588 | 220.057 → 183.766 | -36.291 |
| 2 | 317.196 → 344.828 | 91.823 → 113.850 | 209.295 → 194.103 | -15.192 |
| 3 | 237.881 → 344.754 | 3.574 → 114.229 | 213.816 → 190.891 | -22.925 |

第四对基线在前一次脚本编辑可见后，**profile等待为101.740 ms**，候选为0.203 ms。基线从edit-visible到restore-write共125.675 ms，候选为21.399 ms；这段差异主要是profile等待。相邻强制GC请求区间为12.574→10.610 ms，capture为11.120→10.426 ms，不能把这次长间隔归给GC或产物读取。

profile等待发生在下一次恢复写入之前，虽然不计入那次恢复的wall，仍改变其相对于既有watcher轮询的时机。本轮没有记录每一次无变化stat tick，不能证明唯一的polling相位因果关系，也不能把开启profile后的这四对分布当成原v10性能验证。

## 轮询与GC的准确覆盖范围

下表统计的是输出轮询单次执行区间和与写入→可见窗口重叠的GC记录。GC时长来自entry.startTime/duration；它不是强制Inspector GC请求的总等待时间。

| 范围 | 阶段窗口 | output polls / 读错误 | 单次poll最大ms | driver / CLI GC记录 | CLI单次GC最大ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 全部Native场景 | 96 | 1152 / 0 | 2.517 | 3 / 103 | 2.464 |
| 全部脚本阶段 | 32 | 369 / 0 | 2.517 | 3 / 32 | 1.518 |
| 脚本首次恢复 | 8 | 94 / 0 | 0.975 | 0 / 8 | 1.518 |

首次恢复的8条CLI GC为1.294–1.518 ms。在本轮覆盖内，单次output poll执行和窗口内GC事件均较短，不能单独解释上述百毫秒差异；这不意味着所有等待、GC或I/O成本都被排除。全部96阶段的profile等待最大为102.432 ms。轮询间隔、调度延迟及产物真正变为可见的时点仍影响wall。

output poll读取可达bundle图，包含缓存查找或Babel import解析和匹配判断，不是单次磁盘读取。capture区间也包括sample创建、输入hash、产物、输出快照及比较。CPU是进程累计user/system时间，ELU是主线程active/idle；它们与重叠hook计时不可相加为互斥wall阶段。GC observer交付时的资源快照不代表GC开始/结束资源。

## V1观测失败与V2修正

V1首侧实际完成12个阶段，但preload硬猜样式源为`index.wxss`，遗漏真实`index.scss`，只记录到8/12个driver窗口，比较器明确失败。它是诊断过滤错误，不是产品缺失样式构建；该侧没有纳入V2统计，原工具、衍生目录和失败报告保持不变。失败后另行执行的[独立身份审计](./identity-after-failed-v1.json)通过，核对同一衍生manifest及两侧digest；它不是采集器的正常收尾，原失败报告仍保留error和`identityAfter: null`，不改写为采样成功。

V2在新目录中只改观测来源登记：从既有`driver-ready`读取真实scenario/sourceFile，仅接受固定三个scenario、fixture同目录路径，script必须匹配目标文件；后续事件须匹配已登记映射。未登记、错配、fixture外和无法解析的路径均拒绝，callback/save/read仍只观察脚本。

开始V2采样前，真实v1三类路径映射的12窗口及过滤负例通过；原始/插桩驱动的tsx保真、原子保存ASI与错误优先级、真实watchFile/GC/退出刷写、GC队列drain和分析器完整性harness均通过。13个JS/TS模块及Python语法检查通过。没有改生产保存、排序或polling协议。

## 身份、公开文件与限制

- v10原identity SHA-256：`9e0a974ea754a38ed18483157a1545a6ca925d7ae0c9c052973e47117da848a1`。
- v10基线/候选产物digest：`4fe37ea4d5b4084d08d9286c9386df091eaa37e6e192c968beb23ce1f1582bb2` / `19244b7eab1409c28e2bfc276dab584f4d931a7bb7a665426561e5b3d1c637d2`。
- V2衍生manifest SHA-256：`58b335211f34d1d78534b6c1f65d52c38073e824a24b64d07594db8b9fddeccd`；衍生两侧digest、四类文件的before/after hash、V1身份与原v10来源保留在[identities.json](./identities.json)。V2运行前后核验通过；V1采集器末次字段仍为空，失败后的独立身份审计另列为`postFailureAudit`，核验通过。
- [report.json](./report.json)保留8次运行、96个样本和完整内嵌trace；[driver-analysis.json](./driver-analysis.json)保留96阶段及全部1152次poll；[callback-analysis.json](./callback-analysis.json)保留全部32脚本窗口和四组配对分析；[summary.json](./summary.json)给出上述表格的未舍入数值。
- [profiles.json](./profiles.json)保留8份完整阶段报告及96条原始profile；[logs.json](./logs.json)保留8组V2和1组V1的完整collector/dev日志副本。
- [failed-attempt-v1.json](./failed-attempt-v1.json)及[failed-profiles-v1.json](./failed-profiles-v1.json)保留V1首侧失败；[V1工具](./tool-sources-v1.json)和[V2工具](./tool-sources-v2.json)提供原工具文本及字节hash供审查，不是独立可运行的完整采样包。
- [original-hashes.json](./original-hashes.json)保留90份私有原文件的字节承诺，包括V1失败后的独立审计；[manifest.json](./manifest.json)列出公开副本逐文件SHA-256。导出逐项核对118,665个JSON数值叶子不变，仅对已知根路径、对应相对argv路径和本机Inspector端点作统一占位替换。

可复验公开副本的文件hash、阶段数及表格计算；公开数据不包含原始未脱敏字节、完整emitted JS/maps或冻结依赖树，不能重建原文件或宣称完整独立重放。路径替换不改变数值，原字节hash也不等于公开副本hash。

这里只覆盖本机四对插桩诊断，没有新的40对正式采样、跨平台矩阵、真实IDE或真机验收，也没有Rust增量收益。此前[正式架构性能报告](../2026-10-12-build-architecture-performance/README.md)的失败结论继续保留。
