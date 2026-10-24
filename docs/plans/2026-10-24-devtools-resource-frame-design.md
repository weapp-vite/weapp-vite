# 微信 IDE 资源采样窗口修复设计

资源采样改为由一个常驻的 macOS helper 返回完整进程帧：以 sysctl 作为唯一精确身份源，使用映像前后核验绑定身份，使用 TASKALLINFO 读取可得的 RSS。采样仍只有一个固定 RSS 锚点、三轮库存预算和同一个截止时间。无法核验的身份继续阻断，缩短采样窗口不能替代证据完整性。

本文记录已经实现的契约、已通过的资源回归与单 task 真实 IDE smoke，以及尚未完成的完整 IDE 验收。单 task smoke 不能代表完整验收；原有阻塞、未执行任务及原始证据继续保留。

## 现有失败窗口

旧采样链先准备身份，再读取独立 ps RSS 锚点，最后核验新增身份。元数据、内核映像查询与 RSS 分属不同进程或不同请求，期间短暂出现的进程可能在映像查询前退出。正式[采样入口](../../e2e/utils/devtoolsTaskResources/processes.ts)现已切换到 native 链路；旧 ps/JXA collector、配套 fixture 和测试在按任务精确归档后移除，不再保留两套生产采样源。

需要精确复现的主路径是：准备帧没有子进程 U；RSS 锚点首次列出 U；U 在映像核验前退出；后续帧不再含 U。即使 U 的父进程已经核验为 foreign，也不能据此推断 U 的自身映像。该身份必须保留为 unknown，安装总量不可用。

[身份窗口回归](../../e2e/utils/devtoolsTaskResources/nativeInventory/index.test.ts)现已覆盖“仅在锚点首次出现”的确定性调度，以及准备阶段退出、锚点后退出和微秒级 PID 复用。[祖先关系回归](../../e2e/utils/devtoolsTaskResources/nativeInventory/ancestry.test.ts)补充缺失、未知、成环及不稳定祖先。固定等待、重复采样和循环重启都不能作为复现或修复方法。

原真实 IDE 运行 `d488e440-2a14-42a3-9fba-36fbc838c57b` 对应提交 `1b6d6d3561368cd8be0546b5596ab0f1815b03e8`：task 8 的 runtime 6/6 通过，但资源门禁阻断；此前 7 个 task 完成，其后 26 个 task 未执行。这个结果不因后续资源单测通过而改写。

## 身份源与 RSS 源分别承担什么

不采用 libproc TASKALLINFO 作为全机身份源。已完成的桥接 POC 对一批系统进程返回 EPERM；若把这些行丢弃或当作零 RSS，将降低现有库存覆盖。公共 kinfo_proc 中的 vmspace 是 ABI 占位，旧 text-rss 字段也不能充当完整进程 RSS。ps 的权限和输出覆盖不能被推导为普通 helper 的权限保证。

采用同一 sysctl 家族读取全量身份和按 PID 核验身份。canonical token 为精确的 `(pid, startSec, startUsec)`；同时保留 PPID、完整 BSD 状态和每次观察的位置。PID、启动时间微秒、父进程或已观察到的生命周期发生漂移时，不切换到其他身份来源补证。

TASKALLINFO 只提供 RSS 候选值。成功读取时，其随附 BSD 元数据也必须与 sysctl token 一致；已观察到的不一致不能因该行最终被判为 foreign 而忽略。RSS 已以 bytes 表示，不沿用 ps 的 KiB 乘法。EPERM、ESRCH、短结构和其他错误保留为带 errno 的空值，不能伪造为测得的零。

完整核验为 foreign 的行不计入所选安装 RSS，因此该行 RSS 不可得不影响所选总量。所选安装映像及其 descendant 必须有锚点中的有效 RSS；unknown 无论 RSS 是否可得都阻断。全机身份覆盖仍需由真实 helper 的权限和完整性测试证明，不能只依据 API 名称推断。

## 常驻 helper 与四个协议阶段

使用基于公开 SDK 编译的 Objective-C helper，让编译器确定结构布局和字段类型，避免在 JXA 中手写结构偏移。helper 在一次采样内保持同一受持有 child，返回完整帧；Node 与 helper 每个阶段只交换一个批次。helper 不启动 ps，也不内嵌其他进程库存命令。

helper 构建发生在采样截止时间建立前，并有独立且有限的编译预算。编译器、macOS SDK 或目标架构支持缺失时明确返回不可用，由 Darwin 资源门禁阻断；不得自动安装工具链、提权，或静默退回旧 ps 身份路径。构建缓存须绑定源码、协议、架构和 SDK 身份，不能复用来源不明的可执行文件。

| 协议请求 | phase | 库存轮次 | RSS 用途 |
| --- | --- | --- | --- |
| 1 | prepare | 1 | 全部丢弃，只准备身份与映像证据 |
| 2 | anchor | 1 | 唯一允许冻结并贡献 RSS 的批次 |
| 3 | closure1 | 2 | 只核验身份、映像与新增活动 |
| 4 | closure2 | 3 | 最后一次有界闭合，RSS 全部丢弃 |

四个请求不代表四轮库存。旧实现的独立 ps 锚点不消耗路径请求次数；改为完整帧后，必须将协议阶段上限与三轮库存上限分开，最多两次 closure 不变。不得直接沿用旧“三次请求”限制截断最后一轮，也不得因此新增第三次 closure。

采样继续共用原来的 10 秒 deadline，包含 helper ready、帧读取、既有 fallback 和终验。ready 仍有独立上限。派发前检查剩余预算，返回时也核对截止时间；每个请求不能重新获得完整预算。没有新增 PID 的最终帧若在截止时间到达或之后完成，同样不能记录为完整。

## 每一行必须携带的证明

协议携带版本、严格递增的 requestId、phase、批次起止时间、枚举完整性及逐 PID 行。解析层绑定 ready 与受持有 helper 的精确身份，并生成逐行 gap；消费层根据 phase 映射库存 round，不增加独立可漂移的 wire round。每个请求只能有一个响应，拒绝错误阶段、重复响应、空闲输出和并发请求。`zombie` 必须是 JSON boolean，不能把原生整数装箱得到的 0/1 当作布尔契约。

全量枚举检查 syscall 返回值、实际字节数、结构对齐、容量及 PID 唯一性。ENOMEM、截断、重复、缺行、额外行和 ABI 不符都失败；有限的缓冲区准备不能演变为不断枚举到机器安静。所有枚举到的有效身份都必须有对应证据或缺口。

每个 direct-path 行按相邻操作建立自己的观察窗口：

```text
sysctl identity-before
  -> image-before
  -> TASKALLINFO RSS 候选
  -> image-after
  -> sysctl identity-after
```

前后精确 token、PPID 和必要生命周期状态必须符合连续性规则，两个有效绝对映像必须相等。空映像、路径错误、身份退出、PID 复用、已观察到的 exec 映像变化和 zombie 都留下缺口。只比较进程名、父进程、UID 或秒级启动时间不构成证明。

保留完整 BSD 状态用于审计，并明确普通运行/睡眠状态与 zombie/终结状态的判定。不能因为增加完整状态字段，就无意把普通调度状态变化当作 PID 复用；既有 zombie 阻断规则保持。

64 位字段以十进制字符串传递，内部以 BigInt 校验。报告保留可序列化的精确字符串，不能直接写入 BigInt。RSS 转为 Number 前检查非负安全整数，所选成员求和后再次检查安全范围。

image proof 必须绑定 token、phase、source 和观察区间。即使内部索引仍以 PID 建 Map，每次读取也要核对精确 token；后续复用该 PID 的进程不能继承旧映像。只有本次持有 child 的精确身份可以作为 sampler-owned 排除，不能复用旧 inspectorPid 过滤器去删除其他未知身份。

## 唯一锚点与归属判定

anchor 帧一经完成即冻结，准备及闭合帧中的 RSS 永不补加或替换。归属判断与 RSS 是否可读分开执行：

| 行的证据 | 归属及总量处理 |
| --- | --- |
| 自身映像和所需祖先链均完整证明为 foreign | 不计入安装总量；RSS 空值和 errno 仍保留 |
| 所选安装映像，或祖先属于所选安装 | 计为 selected 或 descendant；必须有有效锚点 RSS |
| 自身映像、精确身份或所需祖先缺证 | unknown，安装总量不可用 |
| 所选成员 RSS 不可读 | 保留独立 RSS 缺口，安装总量不可用 |

自身映像在安装目录之外，不能覆盖 selected 祖先关系。缺失、变化或成环的祖先链不能证明 foreign。RSS 失败也不能触发 foreign 分类。

每一行在帧内完成 direct 证明后保留该帧证据，并尽早分类。若其祖先仍等待 fallback，先保存子行的锚点证明，依赖完成后再判断；不能丢掉该行，然后在 closure 重新采 RSS。已完整核验的 foreign 后来退出可以保留已得证明；从未核验的退出不能获得同样待遇。

准备阶段已观察到 selected 或 descendant，即使在 anchor 前退出，也保留缺失身份门禁。仅准备阶段出现的未知身份若在 anchor 前退出，可记录为 pre-anchor-exited，不能虚构其 foreign 归属，也不能将这个例外套用到 anchor 中出现的未知身份。

所选成员继续接受最终边界检查。已观察到的 absence/reappearance、微秒启动时间变化、PPID/zombie 变化和映像变化永久保留首次缺口，后续字段恢复一致也不能抹除。anchor 后新增 selected 活动继续阻断，不能以之后读取的 RSS 填补锚点。

## 既有 text-images fallback 的证据窗口

保留现有 lsof text-images 来源，不增加新的 fallback。direct path 不可读并不自动证明该进程无关；既有 POC 中仍有非 zombie 的路径缺口，必须获得等价映像证明或继续阻断。

对 prepare 中已知且 direct path 缺失的身份，fallback 必须包围 anchor：

```text
prepare 完整身份帧
  -> lsof-before
  -> 唯一 anchor 完整帧及其 RSS
  -> lsof-after
  -> closure 精确身份终验
```

只有两次完整、非空、规范化后的 images 集合相等，且 prepare、anchor、closure 中精确 token、PPID/zombie 和所需祖先均保持已观察连续，才能提交包围锚点的 text-image proof。必须记录两次查询的区间、来源、身份和错误；不能用一次准备期 lsof 加启动时间不变来替代前后映像证明。

首次在 anchor 出现、且 direct bracket 未完成的身份没有 lsof-before，不能借用其他身份或准备帧的 fallback，必须保持 unknown。

closure 新增身份可以用两次既有 lsof 观察及精确身份终验建立归属证明，但不补 RSS。若需要的终验帧超出两次 closure 或剩余 deadline，保留阻塞。fallback 必经的终验帧同样计入既定库存轮次。

查询失败、空集合、集合不一致、顺序不符及身份变化都不能提交 proof。首次 direct 错误与后续 fallback 结果同时保留，不能把恢复后的证明写成原始查询从未失败。

## 消费层与报告边界

实现按职责分为三层：

- [采样入口](../../e2e/utils/devtoolsTaskResources/processes.ts)只负责平台门禁和传递观察结果，Darwin 进入唯一 native 实现。
- [darwinInspector](../../e2e/utils/devtoolsTaskResources/processInventory/darwinInspector/index.ts)负责公开 SDK 编译与缓存、一个受持有 child、严格行协议和原始帧校验。[helper.m](../../e2e/utils/devtoolsTaskResources/processInventory/darwinInspector/helper.m)只采集证据，不决定应用归属。
- [nativeInventory](../../e2e/utils/devtoolsTaskResources/nativeInventory/index.ts)负责归一化、祖先关系、唯一锚点、两轮闭合、既有 text-images 证明和报告汇总；[报告类型](../../e2e/utils/devtoolsTaskResources/types.ts)定义可序列化的公开证据。

精确 token 贯穿帧解析、稳定身份比较、known/new 跟踪、准备成员、映像证明和失败元数据，helper 验证后仍保留精确秒与微秒字段。普通运行/睡眠状态变化保留原始状态但不改变稳定身份，zombie 转换仍产生永久缺口。

nullable RSS 不能直接参与 reduce 或被默认成零。先确定成员，再逐一验证其锚点 RSS；所选成员缺 RSS 应有独立原因和计数，并参与 incomplete 判定。verifiedMemberRssBytes 只表示已核验成员的部分和，不能冒充完整总量或内存峰值。

无法建立采样时，保留外层 unavailable；已有部分身份和成员证据但无法得到完整总量时，保留外层 observed、内层 installationRssBytes unavailable。同步更新 rssAnchor 和 atomicity 的精确字面量及断言，真实来源改为 sysctl/native 后不能继续报告旧 ps/秒级语义。

失败元数据继续显式白名单拷贝，加入必要精确身份、状态和 RSS 错误字段，不复制 UID、原始 argv、环境、command 或未来结构字段。`NativeImageEvidence` 对映像记录 SHA-256 和 scope：安装内映像另带规范化的安装相对路径，外部映像及 helper 临时路径只保留 hash。这样仍能审计前后映像是否相等，而不暴露其他应用或临时目录。text-images 的单次失败观察与成对 proof 均保存经过相同转换的证据；所选 descendant 的外部 executable 也不写入公开进程列表。

Windows/Linux 仍在采样入口立即返回既有 unavailable；在此之前不读取 realpath、不编译或启动 Darwin helper、不调用 ps、内核路径或 text-images。模块导入保持无原生执行副作用，报告对 RSS 和 installation-exit inspection 的强制要求仍仅限 Darwin。此次修复不扩大安装退出恢复的平台支持。

## 失败收尾与能力边界

helper 持有期覆盖准备、锚点、fallback 和闭合。ready、写入、协议、消费者或预算失败后，都关闭 stdin 并等待同一 child 终态；仅对手中仍受持有的 child 执行必要取消。保留首错，合并收尾错误，重复清理应幂等。手动项目、其他安装、其他任务及登录状态不受影响。

已观察到的 task 身份冲突、单边 direct 映像变化、fallback 集合变化、absence/reappearance 以及查询失败分别保留。后续成功、原始字段恢复或其他 foreign 身份的证明不能删除先前缺口。协议失败即使被消费者捕获，reader 也保持失败状态，不能继续返回成功结果。

本设计缩短跨进程窗口，但 sysctl、映像和 RSS 仍是多个调用。精确启动时间也不能证明一次未观察到的 exec 再切回从未发生。报告只描述已观察连续性及每行区间，不能称为全机原子快照。遇到足够短命、权限不足或真实变化的身份，运行仍可能正确地阻断；不通过白名单、删除行或重采锚点提高通过率。

## 回归组织与旧契约迁移

A–I 是当前回归的九组契约，不是九次采样或九个库存轮次。

| 组 | 回归契约 | 当前覆盖位置 |
| --- | --- | --- |
| A | 首次观察、anchor-only unknown、准备期退出与唯一 RSS 锚点 | [index.test.ts](../../e2e/utils/devtoolsTaskResources/nativeInventory/index.test.ts) |
| B | 精确微秒身份、task 冲突、普通状态与 zombie、已观察映像变化 | [observedIdentityChanges.test.ts](../../e2e/utils/devtoolsTaskResources/nativeInventory/observedIdentityChanges.test.ts)及 protocol 测试 |
| C | selected/descendant、未知与成环祖先、新增成员退出 | [ancestry.test.ts](../../e2e/utils/devtoolsTaskResources/nativeInventory/ancestry.test.ts) |
| D | RSS 空值、安全整数、求和越界、最终身份与计数一致性 | [evidence.test.ts](../../e2e/utils/devtoolsTaskResources/nativeInventory/evidence.test.ts) |
| E | 双 text-images proof、单次观察失败、冲突、祖先依赖及预算 | [fallback.test.ts](../../e2e/utils/devtoolsTaskResources/nativeInventory/fallback.test.ts) |
| F | 固定 deadline、四个有序 phase、额外请求与失败状态保持 | [reader.test.ts](../../e2e/utils/devtoolsTaskResources/processInventory/darwinInspector/reader.test.ts)及 index 测试 |
| G | 精确 wire 整数、返回长度、PID 完整性、UTF-8 与单响应边界 | [protocol.test.ts](../../e2e/utils/devtoolsTaskResources/processInventory/darwinInspector/protocol.test.ts)、[lines.test.ts](../../e2e/utils/devtoolsTaskResources/processInventory/darwinInspector/lines.test.ts) |
| H | SDK/cache、同一真实 child、EOF、SIGTERM 及首错与终态合并 | [compiler.test.ts](../../e2e/utils/devtoolsTaskResources/processInventory/darwinInspector/compiler.test.ts)、[readerFailures.test.ts](../../e2e/utils/devtoolsTaskResources/processInventory/darwinInspector/readerFailures.test.ts)、[native.test.ts](../../e2e/utils/devtoolsTaskResources/processInventory/darwinInspector/native.test.ts) |
| I | 平台门禁、内外 unavailable、字段白名单与映像 hash 隐私 | [processes.test.ts](../../e2e/utils/devtoolsTaskResources/processes.test.ts)、evidence 测试及资源报告回归 |

旧 `twoPhase`、`samplingStartupRace` 的身份窗口契约迁到 A/D；旧 `eager`、`closure` 的新增活动、祖先与有界闭合契约迁到 B/C/E/F；旧 `evidence` 的首次原因、复合漂移与隐私契约迁到 B/D/I。旧 `darwinSnapshot`、`darwinSnapshotScript`、`inspectorProtocol` 的传输和生命周期契约迁到 F/G/H。旧 ps 的 KiB/CRLF 文本格式随 parser 退役，新的 bytes/十进制字符串协议承担数值与完整性契约，不保留无消费者的旧格式测试或 ps 调用次数断言。

新增运行时代码和新增测试均低于 300 行，已经按 inspector、归属闭合、fallback、报告及 fixture 分层，无需为行数再次拆分。`machineLease.test.ts` 仅在现有集成组内调整测试继承环境与同步，不扩大为另一套租约测试结构，也不改变正式租约规则。

## 已执行验证与剩余验收

以下验证发生在正式入口切换和旧 collector 移除后。资源回归执行记录 `native-resource-collector-complete-contracts-20261024` 中已包含入口修改及 17 个旧文件删除，后续范围类型检查也针对切换后的实现。它们与单 task smoke 均不能替代最终提交的完整 IDE 验收。

- [x] 资源范围 16 个测试文件、147/147 用例通过，其中包含 14 个真实 native helper 用例。
- [x] 资源范围 TypeScript 检查覆盖 37 个文件，0 diagnostics；已执行修改范围 ESLint 检查通过。
- [x] SDK 实际编译、缓存复用与权限校验通过；缺失工具链、编译失败和缓存损坏由 mock 回归验证为明确失败。
- [x] 真实同一 helper 完成 prepare、anchor、closure1、closure2，检查枚举证据、逐行区间、boolean zombie 和最终退出；第五次请求及非法请求被拒绝。
- [x] 真实 EOF 在 prepare/anchor 前失败、在有效阶段完成后正常退出；独立 owner 收到 SIGTERM 后，其受持有 helper 终结。
- [x] 受控 Node child 以管道就绪与 EOF 同步，在 prepare 中保留精确身份及映像，退出后的 anchor/closure 不再继承该身份；没有任意 sleep 或重采 anchor。
- [x] A–I 的 mock、协议、报告及生命周期回归保留原始失败、首次原因和哈希隐私证据，按平台分别处理 RSS unavailable。
- [ ] 系统性强制注入真实 syscall ENOMEM/截断，以及让受控 child 分别恰好在逐行 bracket 内不同调用之间退出，尚未执行；当前真实测试不声称覆盖这些精确故障位置。
- [ ] 实际跨用户 TASKALLINFO 权限矩阵未单独穷举；已有真实帧保留 errno/空值，foreign null 与 selected null 的归属差异由确定性回归覆盖，不据此推导其他系统版本或架构的权限保证。
- [x] 最小真实 IDE smoke 在同机串行租约和单窗口预算内通过：1 task、1 case；实际 Stable IDE `2.02.2608080`、基础库 `3.17.2`，官方版本查询 matches。
- [x] smoke 资源报告为 `complete`、`errors: []`；before-cleanup 的 native RSS 采样为 `observed`。RSS 仅在 before-cleanup 采集，before-task 和 after-cleanup 记录宿主/journal 状态，不能描述成三次 RSS 采样。
- [x] smoke 的 scope 与 host cleanup 均成功，所选安装从 selected 终结为 cold，登记端口 released；wrapper 退出码 0、`failures: []`，机器 lease 已释放。受管窗口重叠上界为 1，原生窗口峰值为 unavailable，不能把受管上界写成已观察到的原生峰值。
- [ ] 在干净且同步的根 main 上运行最终完整 IDE 验收；最终提交对应的全部计划内 task、case、checkpoint 和严格资源门禁均完成后才可记为通过。

最终完整 IDE 验收仍未执行。继续保持 `uview-plus-compat,wot-ui-compat` 排除范围，不改写原始资源阻塞，不把 helper、mock 或单 task smoke 成功代替完整 IDE 结果，也不据此更新历史通过率。
