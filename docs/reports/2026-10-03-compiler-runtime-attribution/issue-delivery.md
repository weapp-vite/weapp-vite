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
- 测试产物 watcher 在文件通知后核对已有输入摘要，跳过已发布内容的迟到或重复通知；显式 `rebuild()` 仍强制执行，构建期间的真实修改继续排队处理。
- npm 重写在既有 Babel 遍历中复用带作用域的宿主 API 判断，将精确事实写回当前 chunk 的分析缓存。无 API 的 chunk 不再为平台重写重复解析，内容变化仍失效；不增加全局跨构建缓存。
- classic HMR 的成功和失败原始记录显式输出 `pipeline: standard`，与实际验收协议一致；验收器继续要求原始记录与归因一一对应。
- 独立消费者从候选发布清单取得 Vite 版本；Vite+ launcher/core/Vitest 的批准配对与脚手架共用配置，保留严格 peer 和同实例检查。
- 完整资源 fixture 保留 Vite 的 HMR 事件入口，仅关闭浏览器 WebSocket，恢复 classic 首次编辑的快照调度。worker IPC 和报告保留嵌套 cause、聚合错误及等待边界，递归脱敏；正式采样与超时预算未变。

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
| #1058 | 最终候选的七组正式完整编译对照及对应真实 runtime；旧候选已有 56 个样本，不能替代后续源码修改后的验收 |
| #1065 | Stable IDE 的第三方 compiler 脚本、资产和依赖连续更新，以及内置 Tailwind adapter 的既有运行语义；安装体积不是本议题的验收条件 |
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

候选 `2b7fc65817822f8227d8f4b90f9dfcc80371eef7` 的后续失败已继续定位：

- classic HMR 归因验收发现 raw producer 缺少管线字段；两条真实序列化回归先失败，再随生产端字段修复通过。相关构建服务和验收合约共 108 项通过，未改验收器。重建 CLI 后，实际运行四类 SFC 和九类原生输入的两次编辑/恢复，共 52 个样本通过 raw/报告/归因的严格逐条校验；候选明确标为工作树诊断，不是正式性能对照。
- Vite 消费检查已通过 exports 与安装来源校验，随后同实例检查发现 fixture 固定 Vite 8.3.1，而候选要求 8.3.2；从实际发布清单选择宿主版本，避免再次独立硬编码。
- v7 的 Vite 与 Vite+ 独立严格消费者均通过：32 个候选包的安装来源、exports、负控和单引擎检查通过，dev/build-watch/stateful-dev 的共享导入更新、页面删除与恢复均成功。两者各自的插件 ES6 关闭 profile 通过两条 headless runtime 用例；ES6 开启用例不属于本次 profile，未冒充已执行。消费者临时安装树已清理。该验证绑定第三批冻结工作树，仍不是 Stable IDE 验收。
- classic 正式资源序列在首构成功后第一次编辑等待 180 秒。两页最小场景复现表明 fixture 的 `hmr: false` 禁用了唯一 `hotUpdate` 入口。修复为 `hmr: true, ws: false` 后，首次编辑及错误链共 10 项通过；两页 14 次编辑的 15 个观察全部与新建构建一致，退出后子进程为 0。
- 上述 classic 两页诊断仍触发原 RSS 趋势门禁：三个窗口中位数约 631.8 / 662.8 / 686.9 MB，增长约 55.1 MB。JS heap、watcher 和引擎数量的局部门禁通过不证明内存已稳定，资源问题仍需调查。相同配置的 stateful 两页 14 次编辑、资源门禁和清理均通过；两者都是未提交工作树的诊断，不替代正式 512 SFC 验收。
- artifact watcher 的确定性回归证明同内容晚到事件会产生重复发布；修复后 14 项 API/调度回归和真实 Vitest host 的严格重跑计数通过。该结果不能单独解释历史 Linux 的 `rebuilt=1 / runs=3`，仍需远端诊断。
- Babel 的真实解析回归证明无宿主 API 的 npm chunk 从两次解析变为一次，43 项语义与 sourcemap 回归通过。TDesign 相同本地输入前后两场景均通过，但总耗时波动，不声称远端 1.8 秒问题已经解决或整体性能提高。
- worker 的配置删除场景曾在本机重现没有收到 `app.json` 通知。保留原路径并增加发布尚未结束时编辑配置的受控变体，两者随完整五项 worker suite 通过；增加逐轮事件/产物诊断。尚未确证偶发漏通知根因，不将后续通过改写成已修复证据。

该候选的 Release 已通过；正式 compiler 分析已完成 56 个样本，mode/cache 等价性完成两组各 8 步，stateful 资源与 profile 对照子任务通过。stateful HMR 的 20 组配对及唯一确认后，仍有五个 style/template/JSON macro 场景超过 5%，另有原生输入的 raw profile 缺失或不完整；不能据此通过 #1133 / #1134。其余性能分片和新代码的精确提交验收仍需继续，不使用这些旧候选结果替代下一次提交。

后续候选 `b51e55f6ea2d82b8054aeaf86792c85be63b9481` 的 Release 已通过。当前 41 个范围内 issue 中，28 个已有「已完成」标签，其余 13 个仍等待各自完成条件；没有因工作流调度或局部通过而新增完成标签。

旧候选的 Ubuntu Node 22 与 Node 24 全量 CI 均定位到同一嵌套测试宿主隔离问题：目标源码只重建一次且所属项目正常重跑，随后外层测试修改仓库根 `package.json`，命中 Vitest 默认全量重跑规则，导致无关项目也再运行。该证据区分了默认宿主监听与 artifact 发布，不再把 `rebuilt=1 / runs=3` 全部归因于 artifact 的重复通知。

隔离回归以临时外部依赖清单的受控事件复现：旧默认规则稳定得到第三次全量重跑；限定 fixture 自身的清单与配置后，真实源码 watcher 的所属项目重跑仍成立，3 项真实宿主测试和所属包 typecheck 通过。没有修改共享仓库清单，也没有放宽重跑次数断言。

npm 解析的最小复现表明，以真实 `package.json` 文件作为基准虽能保持近端依赖优先，却会让缺失包的目录回退尝试打开 `package.json/package.json`。改为带尾斜线的目录基准后，当前工程优先、上级依赖回退、同步/异步缺失包返回均通过，相关 27 项测试通过。该错误由依赖解析器捕获后输出，不能据此认定它就是第 18 组自动组件 HMR marker 超时的根因。

资源调查已确认 SFC signature 的强引用 Map 会保留每次历史编辑源码，现改为跟随 Vue 解析描述符生命周期的 WeakMap；35 项相关回归及所属包类型、构建检查通过。这只修复已证明的保留路径，不能把它写成整个 classic RSS 趋势已经稳定。最小独立 Rolldown 对照中，16 次完整关闭后的标记均可回收；Vite 对照仍有环境保留，继续定位跨层所有权，未采用强制 GC、进程重启或放宽门禁作为产品修复。

WeakMap 修复后的 classic 两页诊断仍有 15/15 个产物和 runtime 观察通过、退出后子进程为 0，但三个 RSS 窗口中位数为 592,797,696 / 619,692,032 / 641,368,064 B，增长 46.32 MiB，原资源门禁仍失败。heap 窗口增长约 5.26 MiB，不据此声称已经形成稳定平台。诊断期间 61 个 CLI 分发文件哈希未变；这仍是工作树小规模诊断，不替代 512 SFC 正式运行。

旧候选的正式 SFC 阶段数据已从原始 20 组配对与唯一确认样本汇总至 `stateful-sfc-phase-summary.json`。确认轮的 JSON macro 首次编辑中位数为 wall 641.84 ms、snapshot build 480.05 ms、snapshot publish 3.19 ms；样式首次编辑分别为 646.42 / 545.60 / 3.05 ms。模板首次编辑的 prepare 为 430.76 ms，而脚本首次编辑为 10.62 ms。当前候选的主要开销在编译准备与快照构建；历史 stateful 基线没有 profile producer，不能据此把回退量分摊给某个阶段。`sourceToWatcherMs` 包含源回调之前的编译工作，不解释为纯操作系统监听延迟，各阶段中位数也不能相加重建 wall 中位数。

拓扑重启的 profile 所有权已与快照复用分开：旧会话交出原事件和时钟，新会话只在完整产物写出、模块注册及元数据提交完成后结束记录。不可复用快照的原始源文件在接管及发布时分别核验；无输入证据、版本变化、诊断读取失败或关闭均不会被记为成功。异步核验耗时不计入捕获的发布边界，失败清理等待全部接收方结束。

此修复经过最小组件拓扑的两轮编辑/恢复，再经过原 9 类输入、两轮编辑/恢复的完整 collector：36 条 raw 全部兼容且完整，严格消费 36 条、跳过 0 条。组件和路由拓扑的 8 条记录均为 `full / output-published / known`，归因完整并对应新的 buildId。相关 108 项机制回归、package typecheck 与构建通过；该结果属于第四批工作树诊断，未替换正式 20 组配对性能验收及真实 Stable runtime。

## Stable IDE 环境记录

2026-10-03 05:20 UTC 核对官方渠道数据，最新 Stable 为 `2.02.2608080`，发布日期 2026-09-30。两份该版本安装均尝试了原生 Computer Use 启动，未得到可用宿主；CLI 登录查询超时或缺失该安装的 CLI 端口文件。已运行的 `2.02.2609231` 属于 RC 和其他项目，未关闭或用它替代 Stable。

后续只读检查发现，两种安装的 Electron 应用共用产品数据根目录的单实例锁；Stable 的入口在选择按安装路径区分的数据目录前就申请该锁，现有锁属于运行中的 RC。普通启动 Stable 因此不能建立独立的稳定版宿主。这是环境启动限制，不是已观察到的小程序 runtime 行为。

因此相关 issue **未完成最终验收**。需要可正常启动、已登录且开启服务端口的官方 Stable 安装，或由维护者明确允许切换现有 IDE 后继续；不会为通过检查而降低 runtime 断言。

## 文档与发布同步

功能变更均配中文 changeset，`weapp-vite` 联动 `create-weapp-vite` patch。配置/插件说明同步到 `website/config/hmr.md`、`website/guide/vite-plugin.md`、`website/packages/create-weapp-vite.md`、`packages/weapp-vite/docs/packaged` 和公开 skill。通过包构建刷新随包文档，通过网站构建刷新生成索引，不手工编辑生成资产。

复验入口包括所属包的 `typecheck` / `test:types`、新增的定向测试、`pnpm --filter website-weapp-vite build`、`scripts/check-create-weapp-vite-changeset.ts` 与 `scripts/check-catalog-changeset.ts`；最终提交保留 husky 和 lint-staged 检查。
