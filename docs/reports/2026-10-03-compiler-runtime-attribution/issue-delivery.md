# #1015–#1142 后续交付与验收边界

本轮按维护者要求直接提交到 `main`。实现、局部回归和最终验收分别记录；这里的通过结果不能替代真实 Stable 微信开发者工具验收，也不自动触发 issue 的「已完成」标签。

## 已补充的实现

- `weapp-vite/test` 的编译 artifact 使用独立会话和不可变产物代次，按源码、配置及插件声明依赖验证缓存。`@mpcore/vitest` 通过显式工厂订阅 artifact，只重跑所属测试项目，并等待关闭。
- `create-weapp-vite` 将 `wv`、Vite、Vite+ 工具链与业务模板分开选择。Vite+ 固定配套 core alias 和 Vitest，生成前验证父工作区策略，保留严格 peer 检查。
- 标准插件复用 npm builder，支持回调、跳过、手工映射与原生最终发布。清理按整轮绝对文件归属计算；手工 manifest 的依赖按最近安装目录解析，CLI 缓存跟踪该 manifest 的变化。
- stateful HMR 在入口拓扑变化时一次性交接已验证快照，核对输入内容、目录拓扑和声明依赖。失败时保留旧宿主，修复旧图之外的新文件也会重试完整批次。
- HMR profile 记录真实 transport buildId、源事件、完成时间和互不重叠的阶段，保留无法归因的等待；未完成批次不算成功耗时。
- 编辑序列工具增加完整 Vite/Wevu fixture、headless 语义比较、强制 GC 后 heap、进程树 RSS 和真实资源归属。正常关闭通过 IPC 串行等待当前请求，退出时检查所拥有的 watcher、engine 和子进程。
- classic 构建把 public 资产交给最终 bundler 发布阶段，保留编译产物的路径所有权；完整扫描成功后才推进入口拓扑基线，首构与后续编辑共用串行队列。
- stateful 的 CSS Modules 在原生开发解析边界保留稳定模块身份。独立分包的共享样式由对应子构建单独拥有，避免同一路径重复发布。
- 原生脚本的未落盘判断对比完整产物实际使用的源码版本；恢复原文的补丁成功交付后，后续纯样式更新不再误触发全量重载。完整写出失败会撤销可信基线，真正未落盘的修改仍保留完整重载路径。
- CI rapid-save 回归通过真实运行语义、delivery 确认及 coordinator 完成屏障等待中间发布；Windows CLI 通过 Node IPC 断开进入正常资源清理。
- 模板引用与 prop 同名的本地 setup 绑定时，通过既有派生投影保持本地值与父级 prop 各自的归属，恢复 Wot QR canvas 的生成 ID。Web canvas 只在实际尺寸变化时重置位图，重复属性同步和非尺寸属性更新保留已绘制内容。
- 开发快照采集监听依赖时保留 Vite 原生插件身份，并兼容冻结插件。真实应用的 TypeScript 转译与别名解析继续由原有 Vite/Rolldown 插件负责。
- 对外 `whenSettled()` 等待原生编译、交付、释放、快照及最终发布；编译/写盘失败拒绝等待，只有确认完整基线才恢复发布成功状态，关闭或重启会中断外部观察。
- Vue 相同内容的重复通知在失效分类前按已编译签名判为空更新；显式 sidecar、外部样式、配置与路由变化继续走各自失效路径。
- 四类最小发布包消费者使用独立严格安装，分开记录安装逻辑字节、依赖解析路径、主 Node 进程实际 resolve/load 及构建样本。探针前后的完整产物必须逐字节一致，不把懒加载写成安装体积下降。
- MCP 的默认值归入共享 constants，实际 MCP/IDE 服务按调用加载；IDE 的操作期限与取消仍从轻量 operation 入口同步建立，完整 Launcher 的动态加载包含在既有 deadline 内。automator 根入口与 operation 子入口共享同一类身份。
- automator 新增 AppService heap 能力探测，使用宿主 CDP Runtime.getHeapUsage；协议不支持时明确报告 unsupported，超时、格式错误及普通协议错误继续失败，不填造零值。基准在工作负载计时之外记录前后快照；旧报告字段保持兼容。
- Alipay 默认 npm 输出直接使用已解析的最终 outDir，避免再次解释产物 project 配置中的相对根目录；手工映射保持原语义。
- 复制测试工程时，对所有嵌套 tsconfig 的外部相对 extends 做重定位，保留包名引用、内部引用、JSONC 与原配置相对路径语义；包测试和隔离 runtime 工程共用同一工具，不向共享临时上级目录写文件；跨 Windows 盘符时保持绝对配置引用。
- 发布包通配 exports 校验排除消费者安装器添加的根 node_modules，同时继续验证真实随包的 dist/node_modules、显式导出和符号链接所有权。

大型会话文件继续承担编排职责；新增 profile、输入快照和交接逻辑拆到独立模块。已有超过 300 行的 npm builder 保留同一闭包内的构建去重和资源所有权，避免本次修复同时引入无关拆分。

## 本地证据

| 范围 | 已观察结果 | 解释边界 |
| --- | --- | --- |
| #1015 / #1065 / #1081 / #1134 | 最终构建的五个 provider-compatible headless suite，9 个测试通过；零告警、错误与异常 | 保留真实 IDE 的 CSS 与批次断言；没有宣称 Stable 通过 |
| 原生 Vite stateful 宿主 | `vite-stateful.test.ts` 5/5 通过，覆盖拓扑、重启、失败恢复和关闭 | 新增计数用例证明初始与拓扑变更合计两次快照 |
| 脚手架 | 21 组生成配置，三工具链独立严格安装与六平台构建通过 | 记录候选 tarball 代次，不用旧代次替代后续修改的验证 |
| npm builder | 路径迁移误删与嵌套依赖优先级均先复现失败，再通过回归 | 同时保留用户文件、上级依赖回退及 callback 的工程路径基准 |
| npm simulator | Node/browser-core 20/20，headless Chromium 3/3 | 覆盖实际点击、禁用按钮和最终 npm 路径 |
| 独立候选消费 | 最小页面文本、典型页面 `1 / 2 → 2 / 4` 通过，会话已关闭 | 消费者从自己的安装树加载测试包；不等于 IDE 验收 |
| 完整框架资源冒烟 | 两页、初始加 14 次连续编辑共 15 步，增量与全新构建一致；退出后无子进程 | 这是带未提交修改的小规模诊断，不是干净候选的 512 SFC 正式报告 |
| 批次与入口拓扑 | #1081 事务、#1134 原生拓扑与四文件批次共 3 个 suite、5/5 通过，runtime 无告警或异常 | 包括 classic/stateful 增删恢复；仍需真实 Stable IDE |
| classic 发布所有权 | public 资产碰撞与 Wevu 首构/模板更新共 2 个 suite、9/9 通过 | 对应旧 CI 的三 OS public 碰撞和缺失 app.json 问题 |
| rapid-save 与跨平台关闭 | CI 模式完整编辑序列 15/15，provider 与 CSS 预处理 16/16 | Windows IPC 分支已做回归，仍以远端 Windows job 为平台证据 |
| profile 机制诊断 | 同一两页输入开/关各 15 步；开时 14 个完整事件逐一匹配编辑窗口，关时 0 事件；产物及运行语义一致，退出后子进程为 0 | 未提交候选、小规模单对，仅证明采集机制，不得用作正式性能结论 |
| Vite+ 消费入口 | v3 隔离消费者的 32 个候选 tarball、实际 `vp test run`、watch 所属项目重跑及 `vp create create-weapp-vite -- ...` 成功 | 外层 Vite+ 会自行将 ESLint 迁移到 Oxlint，本次提示 17 条规则未迁移；直接脚手架仍保留 ESLint。三工具链六平台构建属于 v1，后续源码变动需绑定最终包验证 |
| QR 组件 Web 回归 | mobile/desktop 严格截图比较 2/2；canvas 为 160 × 160，深浅像素均超过 20%，属性同步前后图像相同 | compiler 241 项、Web 20 项定向测试及类型检查通过；Web 观察不替代小程序 Stable runtime |
| v5 独立候选消费 | 严格安装的 32 个包共 1712 个文件与归档逐字节一致；四次构建与最小/典型页面 headless 交互通过 | 包含原生脚本恢复、QR compiler、IPC、原生插件身份与最终 settlement 修复；严格安装与89项包解析检查通过 |
| 后续配置与 attrs runtime | 两个 headless 用例通过：隔离 github-issues 的 CSS v-bind，以及 attrs 条件节点隐藏/恢复；useAttrs 完整构建 1/1，profile 脱敏原回归 3/3 | 运行时告警/错误/异常均为 0；真实 Stable 仍未验收 |
| v6 独立候选消费 | 冻结 797 条 registry lock 记录；32 个候选包、1714 个文件、90 项解析检查通过；四次构建、最小/典型页面 headless 交互通过且关闭会话 | 严格 npm install 与 npm ci 均成功；实际安装树及 SHA-512 已核对，未运行 Stable IDE |
| 修复后的 Release 回归 | 四个 watch 场景、独立样式所有权、Alipay npm 输出和配置复制共 8 文件、36 测试通过；共享工具与 npm 路径追加 18 项通过，随后跨盘符扩展的共享工具 13 项通过 | 对应旧候选的六个 Release 失败；不是新提交远端 CI 结论 |
| v5 四类最小消费者成本 | 原生、Wevu、Tailwind、Web 均完成严格安装及各 5 次普通构建、1 次插桩构建，24 次构建通过且探针不改变产物 | 最终冻结源码的单平台诊断；安装缓存未清，不是冷网络基准；MCP/automator 可选加载缺口另行修复 |

两页资源冒烟三个窗口的 watcher 为 `1/1/1`，engine 为 `1/1/1`，进程数为 `2/2/2`；heap 增长约 1.69 MB，进程树 RSS 增长约 27.84 MB，原门禁全部通过。编辑工具的 `elapsedMs` 包含运行时观察和产物扫描，不能称为纯 HMR 延迟；stateful 写出需看 `outputChanges`，不能把未经过普通插件 `writeBundle` 的计数 0 解释为没有写出。

编辑驱动器的 polling 配置曾关闭内容比较，偏离生产路径。新增同长度、固定 mtime 的原子保存回归：旧配置真实 stateful 引擎在 step 1 超时；恢复内容比较后 classic/stateful 两项通过，仍要求中间版本完成实际执行、delivery 和 coordinator 后才继续保存。锁定 Rolldown 所用 notify 在禁用内容比较时只根据递增 mtime 发出修改事件；此用例证明漏事件类别，不将缺少阶段日志的旧 CI 超时全部归因为同一原因。

## 可选加载边界的独立消费者对照

v5/v6 四类消费者均独立严格安装，并各完成五次普通构建和一次插桩构建。每个候选内部，探针前后的完整产物逐字节一致。两代 fixture 源码与配置一致，候选 tarball 引用和 lock 哈希有意变化；不把完整输入哈希写成一致。

| 消费者 | v5 主进程加载文件字节 | v6 主进程加载文件字节 | 减少 |
| --- | ---: | ---: | ---: |
| 原生 | 17,167,743 | 16,301,056 | 866,687 |
| Wevu | 17,167,841 | 16,301,154 | 866,687 |
| Tailwind | 20,639,052 | 19,772,365 | 866,687 |
| Web | 17,646,672 | 16,779,985 | 866,687 |

四类构建均不再加载 MCP 实现。automator 仅保留 8,356 字节的 operation 模块，旧入口为 139,460 字节；相关下游模块也不再随普通构建加载。安装逻辑文件字节反而增加 6,223 字节，未改变安装拓扑或声称安装减负。历史 Mpx → axios 链未在这四类当前安装树出现，不能据此推论其他消费图或安全可达性。

两代产物的文件集及大小一致。原生与 Tailwind 全部字节相同；Wevu 的差异为打包器 region 注释中的候选安装路径，Web 的差异包含输入绑定元数据中的消费者路径，故跨候选不声称逐字节一致。构建样本使用现存文件系统和包管理器缓存，不能解释为冷网络安装或正式耗时收益。

同目录 `provider-cost-before.json`、`provider-cost-after.json` 和 `provider-cost-comparison.json` 保存归档 SHA-256、SHA-512、输入/输出身份及观测摘要。原始报告的通用路径脱敏曾误伤部分 SHA-512 base64 斜杠；摘要只在验证归档 SHA-256 相同后重新计算完整 integrity，原报告保持不变，脱敏实现另加回归。两代均为有未提交修改的本地诊断，不冒充干净提交的正式验收。

## 尚未满足的完成条件

| Issue | 剩余实现与最终证据 |
| --- | --- |
| #1015 | Stable IDE 中 classic/stateful 的 CSS 变量连续替换、删除、恢复及交互 |
| #1058 | 七组正式完整编译对照及对应真实 runtime；机制和历史字节归因见同目录 README |
| #1065 | Stable IDE 的第三方 compiler 脚本、资产和依赖连续更新；四类安装/加载测量不能代替安装拓扑优化与上游取舍结论 |
| #1081 | Stable IDE 的 Tailwind 样式、JS patch 与批次一致性 |
| #1082 | 固定批准基线的三 OS、九分片完整性能验收；历史基线缺陷必须单列 |
| #1097 | 已验证实际 Vite+ runner/create；仍需最终候选运行时及跨平台矩阵收敛。缓存和 Dashboard/MCP 为 issue 明确的非阻塞增强 |
| #1133 / #1134 | 真实输入类别的阶段归因、profile 关闭/开启产物一致性及正式样本 |
| #1135 | 干净候选、512 SFC、14 次连续编辑的正式资源门禁与动作族回归 |
| #1136 | 最终候选消费证据归档及真实 Stable runtime；历史 170,668 B 归因见同目录 README |
| #1137 | 已实现宿主 heap 协议探测与前后快照；仍缺普通/预设同输入的真实 Stable host commit、内存与工作负载样本，现有 headless 数据不支持收益结论 |
| #1140 | 干净候选的 dev/prod 与外部缓存恢复等价性，以及目标 runtime |
| #1142 | 所依赖的子议题完成上述验收后再完成总跟踪项 |

`Compiler and Resource Acceptance` 手动工作流要求输入完整提交 SHA，并核对实际 checkout 与 `github.sha`；分别采集七组 compiler 对照、classic/stateful 的 512 SFC 资源门禁及 mode/cache 等价性。profile 按 off/on/on/off 顺序执行两组独立对照，逐次核对真实源事件、输入、产物、runtime 语义和资源清理，默认开销门槛为 5%。原始日志与报告随工作流归档，失败和缺失证据会使 job 失败。

`HMR Attribution Acceptance` 使用独立干净 checkout、完整提交 SHA、同一 runner 和一致输入，按两种 runtime 分别执行 4 类 SFC 与 9 类原生输入、20 组交错对照；超过 5% 仅允许一次等量确认。此诊断基线为 `73b76f4acde84a4ac8c25f4b816119b19704ac28`，不替换 #1082 批准的 `e7862e61dd83e3b9e356ac1e176267b31ab298af`。历史 stateful 没有 profile producer，报告明确记录不可用，不补造归因。

旧候选的 CI E2E run `37105316260` 最终有 17 个失败 job，均已分类。第一轮定向 workspace nightly 执行了 26 个场景，全部通过且无门槛超限；8 个 compiler 样本的 P95 为 1059.84 ms，已执行的原生样式场景均只改写一个文件。但另有两个应用在测试前启动失败、六个场景未执行，整轮仍判失败。

原生插件身份修复后的第二轮，五个项目均启动成功，15 个场景通过 14 个，6 个 compiler 样本的 P95 为 307.26 ms，门槛超限为 0。`apps/subpackage-shared-chunks` 的模板、脚本、样式全部通过；`apps/vite-native` 的 CSS marker 已实际更新，但验收脚本强制 `--skipNpm` 导致递归引用的 TDesign 样式缺失。脚本恢复正常 npm 构建后，最终第三轮五个项目的 15 个场景全部通过、无跳过，6 个有效 compiler 样本 P95 为 139.73 ms，门槛超限为 0；仍保留严格样式引用校验。不能把新工作流已提交或已调度写成验收通过。

最新四次两页 profile 诊断按 off/on/on/off 串行执行，输入哈希与全部逐步观察哈希一致，四个运行身份独立且退出后子进程为 0。两次开启分别记录 14、15 条完整原始事件；多出的一条来自同内容 Vue 通知被误分类后的快照刷新，不能算成初始构建噪声。修复后重新执行开/关两轮，两轮各 15 步通过、输入与逐步观察一致、退出后子进程为 0；开启时恰好 14 条完整事件，关闭时 0 条，不再多出快照。所有诊断报告保留 `clean: false`，正式比较器按预期拒绝这些脏候选。

## 后续 CI 收敛

已推送的 `1806b6df43efede85520ef3a2a6c188ec6cf11dd` 仍暴露可修复失败，本批逐项处理，不能用旧候选的绿色检查替代它：

- Release 的四个嵌套 tsconfig watch 失败、独立分包样式旧断言、Alipay npm 最终路径错误已完成本地回归。
- 六组 DOM headless 在复制 github-issues 工程后共同遇到嵌套 extends 失效；共享重定位工具已接入真正的 E2E 复制入口。
- 八组 Vite 消费门禁失败于安装器私有 node_modules 被通配 exports 当成随包文件；独立消费者导出验证和八项回归通过。
- Windows 的报告路径、Vite npm 根路径和 snapshot fixture 短路径断言分别按各层规范路径契约修正。
- useAttrs 的本地 computed 与同名 prop 分开投影后，旧测试绑定了内部字段名；改为解析输出中条件节点结构，同时保留实际隐藏/恢复行为验证。
- Linux artifact watcher 的第三轮重跑尚未在本机复现。增加初次恰一轮、触发文件/原因/状态/事件日志，保留最终恰两轮断言，等待新 CI 的定位证据；没有无依据地修改订阅层。
- Workspace HMR 全量 229/229 场景通过，但 TDesign 多平台应用的 template/script compiler 分别 1805.87/1781.58 ms，超既有 1500 ms 门槛，整轮仍失败。分阶段耗时有嵌套和重叠，不能相减归因，也未放宽门槛。

## Stable IDE 环境记录

2026-10-03 05:20 UTC 核对官方渠道数据，最新 Stable 为 `2.02.2608080`，发布日期 2026-09-30。两份该版本安装均尝试了原生 Computer Use 启动，未得到可用宿主；CLI 登录查询超时或缺失该安装的 CLI 端口文件。已运行的 `2.02.2609231` 属于 RC 和其他项目，未关闭或用它替代 Stable。

因此相关 issue **未完成最终验收**。需要可正常启动、已登录且开启服务端口的官方 Stable 安装，或由维护者明确允许切换现有 IDE 后继续；不会为通过检查而降低 runtime 断言。

## 文档与发布同步

功能变更均配中文 changeset，`weapp-vite` 联动 `create-weapp-vite` patch。配置/插件说明同步到 `website/config/hmr.md`、`website/guide/vite-plugin.md`、`website/packages/create-weapp-vite.md`、`packages/weapp-vite/docs/packaged` 和公开 skill。通过包构建刷新随包文档，通过网站构建刷新生成索引，不手工编辑生成资产。

复验入口包括所属包的 `typecheck` / `test:types`、新增的定向测试、`pnpm --filter website-weapp-vite build`、`scripts/check-create-weapp-vite-changeset.ts` 与 `scripts/check-catalog-changeset.ts`；最终提交保留 husky 和 lint-staged 检查。
