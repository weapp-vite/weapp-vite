# 全仓依赖升级与代码迁移（2026-11-06）

本轮从 `main` 的 `0a92cd2647c409a3ce756b303157dca0e8d0e48e` 开始，按已确认计划升级当前维护依赖，并处理上一轮冻结语料、Workspace HMR 与真实 IDE 的验收缺口。本文随实际验证更新；未完成项不计为通过。

## 版本与兼容边界

| 对象 | 升级前 | 本轮目标 |
| --- | --- | --- |
| pnpm | 12.16.1 | 12.18.0 |
| @swc/core | 1.16.21 | 1.16.22 |
| weapp-tailwindcss | 5.6.3 | 5.7.1，缓存合约缺口见下文 |
| @weapp-tailwindcss/engine | 0.1.6 | 0.1.7 |
| sass | 1.107.1 | 1.108.0 |
| sass-embedded | 1.107.1 | 保留 1.107.1，排除 1.108.0 |
| Playwright | 1.64.1 | 1.65.0 |
| theme-transition | 2.1.2 | 2.1.3 |
| Wrangler | 4.157.0 | 4.158.0 |

TypeScript 按用户选择继续使用 6.0.3。Stylelint 保留 17.16.0：现行配置链的 Tailwind、SCSS 与 recess-order 插件尚未全部接受 18。自有直接 local-pkg 保留 1.2.1：2.0.0 发行声明中的 `loadPackageJSON` 仍引用未声明的 `Args`，不通过放宽类型检查绕过。

独立 Vite 8.3.6 本轮仍未通过完整生命周期诊断，继续保留 8.3.5。已核实诊断的模块和清单均为 8.3.6：hooks、resolver、mini-optimizer 通过，web-optimizer 在立即关闭及请求空闲后关闭两种路径均留下新建的 deps_temp 缓存；polling、ready 未执行。原始失败和已确认的资源清理记录均保留。早先诊断隔离器出现模块与清单身份分歧，该次结果没有用于版本决策。

现行 Vite 8.3.5 / Rolldown 1.2.16 的固定版本验收例外不延伸到新组合。Rolldown 1.3.0 超出 Vite 8.3.6 的 `~1.2.16` 官方配套范围，本轮保留 1.2.16。VitePress 与 vite-tsconfig-paths 的现有预发布基线继续保持。

Node、Rust、Bun、独立小程序 CI runner、Cargo 直接依赖和 GitHub Actions 已完成差分核对，无新增升级目标。Cargo 中父范围无法容纳的全局 latest 差异继续保留，不加不兼容 override。历史工具链、性能 baseline、外部 upstream 和兼容夹具维持原用途。

## 迁移说明

pnpm 的根版本和 snapshot 工作流通过同一版本输入同步。两份工作流由 repoctl 官方 `getSnapshotWorkflows` 成对生成，发布端的 builder SHA 随生成结果更新；官方模板中的 Node 24.22.1 固定值保持不变，完整字节校验继续执行。

真实 Core 双 CSS 入口回归已证明不同 `@config` 的主题值、依赖和定向失效相互隔离。Tailwind 5.7.0 的 PostCSS 4 链删除了动态 alpha 识别及占位保护，将 `color-mix(in srgb, #123456 var(--opacity), transparent)` 作为不支持的声明删除，只剩不透明 fallback；5.6.3 正常保留 `rgba(..., var(--opacity))`。默认及原配置、两种模式的官方实体对照一致，公开配置无法恢复等价小程序语义。5.7 的 compiler service key 变化还使普通源码扫描与候选变化不能复用原 engine，插件初始化次数增加。

第一至四阶段因此偏离原定 5.7.0 目标，保留 compiler 5.6.3，沿用 `^` 前缀并增加 `<5.7.0` 上限，保护独立安装消费者；不拼装跨主版本 PostCSS、不复制颜色编译器、不放宽契约。直接 engine 升级 0.1.7：隔离对照中 5.6.3 搭配 0.1.6 与 0.1.7 的颜色、缓存和插件初始化结果一致。官方 5.6.3 自身精确依赖的 engine 0.1.6 保留正常闭包，不做 override。证据在任务目录 `tailwind-alpha/receipt.md`。按用户授权已提交并回读核验[上游 bug #1332](https://github.com/weapp-tailwindcss/weapp-tailwindcss/issues/1332)，附公开 Core 最小复现与两版输出；未上传含本机信息的完整日志。

用户随后要求采用新发布的 latest。本轮已将 catalog、固定 catalog、静态 init fixture、生成的脚手架 catalog 和锁文件更新为 5.7.1；官方依赖闭包为 engine 0.1.7、PostCSS 4.0.1。原颜色复现的动态 alpha、变量 fallback 和静态 50% 均恢复，`generate().css` 与 `rawCss -> transformCss()` 结果一致。连续两次离线冻结安装、catalog 同步、锁文件闭包和 Rolldown 单版本检查通过；适配器 64 项测试、所属类型、公开类型与构建通过。

5.7.1 的真实集成范围为 40 文件、356 用例，351 通过、5 失败。失败仍是缓存合约：普通持久构建将 `scanSources:true` 切成已解析规则数组后，未变输入的插件初始化从 2 次增加为 4 次；封存内存 HMR 从 `true` 切到 `false` 时 `cache.engine` 为 false。官方服务键只排除显式 candidates，扫描模式与完整内存 sources 仍属于身份；不能从独立 candidates 实验推断真实 HMR 复用。原断言、冻结来源、配置失效与性能阈值保留，公开 generator 和 Core snapshot API 的隔离对照结果见下文；未采用新适配层，也未判定兼容升级完成。完整日志见任务目录 `tailwind-571-integration-all.log`，旧失败证据继续保留。

5.7.1 后续评估已完成本地定向范围：应用及模板 80/80 构建任务成功，全部实际执行、没有命中缓存；weapp-vite 重建及类型检查通过；网站重建和 8 项后台 Chromium 测试通过。新增三项颜色参数化回归覆盖动态变量、变量 fallback、静态 50%，同时校验生成与收尾结果，所属单文件 9 项通过。上游 #1332 已关闭，关闭时间为 2026-11-06 15:05 UTC；这是颜色问题的修复状态，不覆盖缓存限制。

源码冻结、暂停本任务其他 shell 与代理之后，按原 baseline 和原阈值运行 8 个 Tailwind 项目的定向 Workspace HMR：19/19 场景通过，实际全部为 classic，19 项 profile 均有当前原生发布身份，性能超限为 0。总耗时 P95 与最大值均为 1466.87 ms；37,986 个源码文件运行后哈希无变化，验证进程及本轮资源已退出。报告为任务目录 `tailwind-571-hmr/report.json`。这是所选项目的证据，不能替代 76 项目全量 HMR、完整 headless 或干净同步 main 的完整 Stable IDE 验收。

缓存迁移评估没有采用额外适配层。固定 Node 24.22.2 的公开 generator + Core snapshot POC 在 12 阶段与独立新 Core 的 CSS、候选、snapshot、模板、JS 与 sourcemap 等价，全部实例释放；但落到产品需要自行维护 owner、失效、撤销和清理。更小的“取消扫描规则缓存、每次交给 Core 自动扫描”对照也保持输出等价，却在 TS/Vue 更新、创建、删除和恢复时每轮重新执行真实 config/helper，破坏已有配置复用边界。因此保留原集成、原缓存断言和原阈值。用户在获知 5 项缓存合约失败后，于 2026-11-07 明确要求提交并推送全部当前改动；按该授权推进提交和推送，保留原生 hooks 与全部失败记录，不将此操作记为兼容升级或全仓交付验收通过。

候选的 weapp-vite 公开类型和 create-weapp-vite 类型检查也已通过。依赖审计单独记录：2894 项依赖，low 6、moderate 19、high 17、critical 8，退出 1；告警数量分布与上一候选一致，不据此推断每项 advisory 身份未变，也没有增加不兼容 override。原候选和此次定向范围的证据各自保留，未对尚未通过的缓存合约启动发布、部署或正式完整 IDE 验收。

独立 Sass 升级到 1.108.0。sass-embedded 的官方 Windows x64 1.108.0 发行包缺少 `sass.snapshot` 与 `sass.bat`，host 因而回退到不支持 `--embedded` 的纯 JS 实现，使 Windows 构建、HMR、headless 和 Dimina 在进入业务断言前失败。官方 tarball 的 SHA-512 与 registry 及锁文件一致，host 的编译器定位逻辑与 1.107.1 逐字节相同；核验时没有稳定修正版。因此 embedded 保留完整官方 1.107.1 闭包，沿用 `^` 前缀并增加 `<1.108.0` 上限，不覆盖单个平台包或改写 vendor。Playwright 浏览器缓存继续由实际版本与 revision 生成，没有新增机器专属缓存路径。

uview 的修复以普通转换和资产刷新使用同一 uni-app 平台预处理输入为边界，保留原始源码签名及错误传播。Vue 入口拓扑变化触发完整入口扫描，当前可达图重新建立资产所有权；只有成功扫描才提交拓扑基线，普通内容更新继续使用局部扫描。最终入口、模板、JSON、样式与 scoped slot 仍由 bundler 负责发射、写出，不补写缺失 bundle。原生 watcher 回归已覆盖首次构建、本地组件和页面修改及恢复、移除 npm 组件 import/tag、删除无引用 SFC，以及 JS/JSON/WXML/WXSS/scoped slot 完整性；定向 uview Workspace HMR 已通过，完整 workspace 仍待验收。

HMR 分别核对 Vue 资产阶段和 core rewrite：补齐各自墙钟、候选与发射数量、缓存命中及重新编译观察。纯内容分析缓存与 hook context 分离；源码、外部 SFC、路由、layout、配置、删除及失败重放继续参与失效。classic 模式、既有阈值和历史 baseline 保持原样。

远端 CI 进一步暴露完整入口扫描提前返回而没有记录发射统计的问题。完整扫描现在与局部计划共用本代计数和诊断，异步保存产生的新 profile 不被旧代覆盖；组件引用增删明确验证完整扫描与 JS/JSON/模板资产，同拓扑文本修改继续验证局部计划。uni-app 兼容转换在读取当前原文后复用会话内纯字符串结果，缓存上限为 2048 项、32 MiB，完整模块身份、声明块类型、平台和配置均参与键；不保存 AST 或 hook context，错误不缓存，命令终结即使前段资源清理失败也释放纯缓存，restart、旧 owner 和借用子会话保留正确归属。本地组件候选检查按构建代次合并同路径 Promise，仍支持与内置标签同名的组件，注册变化、失败和新代均失效，旧代异步结果不能写入新代。

E2E suite 参数统一处理等号与空格形式，错误选择在启动前失败。真实 IDE 的进程身份、订阅和窗口收尾继续按原资源门禁验收，不扩大超时或忽略未知进程。

## 验证记录

实际命令、候选身份、退出状态及资源记录保存在任务状态索引。顺序为冻结安装与同步、定向单测及类型、包构建、下游与浏览器、完整 CI/HMR/headless，最后从同步且干净的 `main` 执行正式 Stable IDE 验收。进入正式完整验收后冻结源码。

两次冻结安装均通过，第二次离线安装前后的锁文件、workspace、根清单和生成 catalog 哈希一致。Rolldown 单版本及 snapshot 官方模板全文检查已执行。E2E 参数解析的三文件定向回归通过；新增测试已接入根测试发现范围。

升级前后 pnpm 安全审计均退出 1，按 advisory/module 计数为 low 6、moderate 19、high 17、critical 8。5.7 候选图一度降至 2893 个依赖，保留兼容 compiler 后当时的图为 2916，随后保留完整 Sass 兼容闭包后为 2917；最终审计告警数量保持不变，该结果不记为安全审计通过。peer 检查仍报告 graphql、mermaid、vite、vitepress、webpack 的范围问题，保留上游范围与现有预发布基线，不用不兼容 override 清零。

第一次完整单测为 2614 文件、25427 用例通过，8 文件的 13 用例失败。9 个失败由 Tailwind 5.7 的颜色与缓存回归引起，选回兼容依赖后，所属 5 文件 48 项契约通过。其余边界已分别修正：宏测试提供真实 App 输入；外部 SFC 的跨 snapshot 检测只读取合法钩子记录的有界路径事实，不调用过期 resolver；编译失效器补齐 `jsx` 依赖域，覆盖页面自身修改后共享 JSX 模板再恢复。重建 weapp-vite 后，宏、共享模板、JSX HMR 与 uview 原生产物共 4 文件 14 用例通过，原断言和预算保持不变。

HMR 优化前的全量公开类型矩阵 88/88 任务通过，owning-package typecheck 与 74 个变更文件 ESLint 通过；兼容图的连续两次离线 frozen install 通过。当时源码与兼容图的完整单测重跑退出 0：2622 文件、25446 用例通过，保留原有 13 文件、20 用例跳过，没有新增跳过。后续 HMR 优化需要重新验证受影响范围。新增拓扑签名、路径事实和内容缓存按职责拆分到独立 helper；已有超过 300 行的编排文件保持原入口结构，避免在依赖迁移中同时改动无关生命周期。

最终 HMR 优化候选的完整单测重跑退出 0：2628 文件、25516 用例通过，原有 13 文件、20 用例跳过；113 个候选文件的运行后哈希完全一致。随后修正静态 init fixture 的 Tailwind 范围遗漏，直接校验与 catalog 一致、允许 5.6.3 且拒绝 5.7.0，ESLint 通过。只读审查提出的 script setup 条件编译疑点已通过正规 CLI 构建复现：微信 WXML 正确移除 Hidden，但 lower usingComponents 仍注册 Hidden；该后续修正及相关范围验证单独记录，不追认到此前完整单测。

组件元数据改用统一的平台预处理输入后，8 文件、153 项定向用例、owning package 构建与类型检查通过；最终公开类型入口的 88/88 Turbo 任务通过，包含前置构建，不将其记为 88 个独立类型合约。随后原生 watcher 回归新增外部 script setup 与 template block，暴露空 script block 的零长度覆盖错误；修复后所属 18 项用例、compiler 构建、类型与公开类型检查通过。继续运行原生回归，JSON/WXML 已正确裁剪引用，但 HiddenChild 仍产生没有对应 JS 的 JSON/WXML，确认编译缓存被错误用作资产发射所有权。当前逻辑入口归属修复的 197 项定向用例、128 文件 ESLint、weapp-vite 类型检查及构建已通过；原生回归的首次构建和本地修改/恢复均通过，包括禁止孤立 npm 组件资产的断言。原先外部模板置于 node_modules 不在默认监听范围，保留失败并将可编辑输入移入项目 src；不扩大第三方包监听。新代次随后暴露另一缺口：完整入口重扫后，父 JSON 仍注册 ActiveChild，但 pre-core 图已不含其逻辑入口和任何 JS/JSON/WXML。根因是长期 output→source 映射被同时用于跨代 emit 去重。修复复用现有 EntryChunkLifecycle，让 loader 与 Vue compiler 共享本代入口注册、去重与失败回滚，路径映射继续只保存解析事实；新增 71 项定向用例、owning package 类型与构建通过。最终原生 watcher 回归已完整通过首次构建、本地修改/恢复、项目外部 template block 修改/恢复、页面修改/恢复、移除与删除，以及 scoped slot 和 JS/JSON/WXML/WXSS 完整性检查。全量候选验证仍继续，以上较早通过记录不追认为后续源码验证。

中文 patch changeset 记录实际受影响的 weapp-vite、create-weapp-vite、Tailwind 适配、dashboard、glass-easel web adapter、AST 和 wevu compiler 七包；固定发布组由原生版本流程联动。本轮采用 Conventional Commits，保留提交和推送 hooks。

原 12 场景的第一轮 HMR 优化复测退出 1：9 个已执行场景的更新行为通过，uview 的 3 个场景因日志 JSON 损坏而未执行。runtime demo 的 Vue script 为 1723 ms，高于 1500 ms；wot 为 5487–6136 ms，高于 5000 ms。请求兼容分析缓存跨轮命中 2542 次、未命中 2 次，对应阶段降到约 7–11 ms；剩余入口分析继续定位。uview 的失败已确认是测试采集层将 543 字节 stderr 告警插入跨分块 stdout JSON；修复保留原始分流 trace、追加式游标和严格 JSON 校验。原失败日志未改写。随后统一 lower Vue 本轮输入读取：普通无 JSON 组件也复用已读取的物理源码，避免重复读取；下一轮仍读取新输入，外部 block 继续独立解析。复测原 12 个场景全部执行并通过行为、恢复、receipt 与原性能阈值，实际模式均为 classic：runtime demo 751–802 ms（上限 1500），uview 4191–4419 ms（上限 6000），wot 3695–3972 ms（上限 5000）。完整 workspace 尚未执行。

冻结 Taro 4.3.2 的配置校验不接受 `compiler.runner`。本轮使用正式生命周期插件，在官方 schema 校验后安装 CJS Mini runner 薄包装，并在 webpack-chain 配置分发期间共享同一真实插件构造器及参数，结束后移除临时 hook 入口，最终只应用一个 Mini 插件。官方 STATIC 依赖的私有 key 在 Mini runner 与 JSUI 插件间不一致，兼容视图仅限官方调用期间且只回退唯一的真实依赖。

新身份 `taro-4.3.2-harmony-jsui-0d2275229618d381` 已执行 development、production 两种真实生成。模式、runner 和 STATIC 协议均到达主编译，但两种模式都因官方 Harmony 默认导出与官方 page loader 再次追加默认导出而失败。官方 npm tarball 完整性与安装文件逐字节核对一致；没有通过改写官方输出绕过此发行缺陷。JSUI runtime 另有六个基础 runtime 未发布符号的独立缺陷，预编译回退和主编译 warning 与上述 fatal 分开记录。

旧活跃冻结归档保持原样，离线 check 能读取完整归档，但退出 1：仅剩 Harmony 两种模式的失败记录与两条 expected-built 矩阵缺口。新候选未替换活跃归档，未 collect 为成功。旧 archive 的 inventory 为 13,558 文档、26,228 origins、7,075 非微信文档、250 仓库、pending 0；该库存校验不代表 Harmony 构建通过。证据保存在任务目录的 `corpus/active-check-reports`、`taro-jsui-freeze.json` 及两种模式原始日志。

网站单测通过。最终文档更新后的 build、8 项 headless Chromium 浏览器测试，以及稳定和预览配置的 Wrangler 4.158.0 dry-run 均通过，未执行部署，browser/server 已收尾。glass-easel adapter 浏览器验收与 simulator 的 102 个文件、223 个浏览器用例通过，已释放各自 browser/server。Playwright 1.65 的 Chromium 已安装，Firefox 两轮下载均因官方 CDN 超时失败，WebKit 独立下载 49 分钟后取消，退出 130，避免与性能采样重叠；没有活跃下载。

主线 push 原生触发 Release 和文档 preview 部署。事后取消存在发布抢先执行的竞态，因此本轮提交使用 GitHub 原生 `[skip ci]` 指令阻止本次 push 自动运行，保留全部提交和推送 hooks，不修改或禁用工作流、不批准部署环境。该指令不影响 `workflow_dispatch`；全部适用验证仍按最终候选 SHA 手动派发原生 workflow，逐项记录真实结果。被阻止的 push 工作流记为未执行，不计为验证通过。

第一阶段依赖与 E2E 基础设施已提交为 `a5c297729`，暂存范围 ESLint、DOM 清单、包级类型与原生提交 hooks 通过，当时尚未推送。首次提交被 changeset 摘要格式门禁拒绝，补齐 Conventional 类型后正常重试通过，未绕过 hooks。

逻辑入口归属修复后的完整单测退出 1：2,622 文件、25,520 用例通过，10 文件、25 用例失败，原有 13 文件、20 用例跳过；运行期间 134 个候选文件哈希没有变化。失败分别暴露独立 hook 测试未提供逻辑入口图、静态 input 被动态编译器重复发射，以及无脚本布局的 JS asset 未被 chunk collector 识别。测试夹具改为显式提供当前逻辑入口；静态与动态入口使用同一代次去重账本；无脚本布局仅在当前合法父入口、layout 依赖和本 output 实际 JS asset 同时存在时发布配套资产。修复后 15 文件、154 用例、weapp-vite 包级类型及 14 文件 ESLint 通过，两个独立分包回归的重复 JS 与缺失 CSS 同时消除；完整单测仍须在后续源码上重新执行。

随后原生发布全生命周期和公开类型回归通过，apps/templates 的 80/80 个 Turbo 任务成功（34 个命中缓存）。第二轮完整单测为 2,631 文件、25,546 用例通过，1 用例失败，142 个候选文件哈希未变。唯一失败来自 classic 启动恢复测试的总发布计数：恢复产物和闸门启动已确认，但此前完成的写出也被计入，导致预期 0、实际 1。保留原失败；独立 trace 运行通过，但不能据此改写完整运行结果。测试探针改为依据原生 build 产物的恢复 marker 持有闸门并记录该次完成，其他关闭场景继续核对总发布数。三项确定性回归覆盖旧回调在闸门前、期间完成及其他宿主写出，包级类型和三文件 ESLint 通过；原生 integration 及完整矩阵仍待重新验收。

恢复门禁修正后的 3 项原生启动失败/恢复回归通过。最终完整单测退出 0：2,633 文件、25,550 用例通过，保留原有 13 文件、20 用例跳过；145 个候选文件在运行前后哈希一致。没有用单次 trace 的通过覆盖较早的完整运行失败。

最终脚手架 smoke 的六组场景均已评估：npmjs 的 wevu、Tailwind 和 npmmirror 的 Tailwind 完成安装、构建及开发更新；npmjs 的 default、npmmirror 的 default/wevu 在原 600,000 ms 安装预算内网络超时。汇总退出 2，记录为环境受限，产品失败为 0；临时目录、开发进程和串行租约已完成收尾。先前状态索引将 npmjs 误记为三组通过，已依据实际报告纠正。

严格单任务 IDE 诊断实际只派发 native-property-delivery，1 个 task、3 个 case、9 个 checkpoint 通过。执行时重新查询官方 Stable，并核对所选安装、CLI 和实际宿主均为 2.02.2609240，基础库为 3.13.2。首次 Tool.getInfo 在原 4 秒预算内超时，既有连接重试随后成功，没有重开窗口；App.CDPEnable 明确返回 unimplemented 后，既有 App.enableLog 精确回退成功。本次没有复现旧订阅阻塞，也没有据此修改源码或追认旧失败。

该诊断的 task 退出 0；外层按严格局部验收规则退出 1，记录 partial / incomplete，余下 27 个适用任务未执行。资源报告 complete，窗口同时具有原生关闭和 webContents 销毁证据，端口与 journal 释放、宿主正常退出及机器租约释放均已核验。受管窗口重叠上界为 1；清理前 RSS 单点为 2,128,953,344 字节，不记作内存峰值。启动 monitor 的实际内存游标未持久化，外层两次日志观察仅作诊断且存在轮换，不能替代该游标；关闭阶段的真实文件身份、offset、anchor 与销毁事件仍保留。生成报告已归档到任务证据目录，未混入源码提交。

最终公开类型矩阵退出 0，88/88 个 Turbo 任务成功，43 个命中缓存，包含前置构建，不记作 88 个独立类型合约。候选文件 ESLint 及 diff 空白检查通过；完整单测后只更新了迁移记录，源码与测试未再变化。

按用户本轮明确要求采用 patch changeset。AST 的新增分析结果和 compiler 的可选静态标记、block 类型用于修复现有条件组件与输入识别，既有公开调用继续兼容，新增公开类型已补 tsd；没有将这些修复扩展为新的产品功能。

本轮尚在实施，完整 CI、HMR、headless 与正式干净主线的完整 IDE 验收未完成，不能据此声明交付完成。


第三阶段针对远端候选 `8b5953d590900be613dafec921675e196e0d138d` 的失败继续修复。该候选的完整 Workspace HMR 已完成 233/233 项行为检查，但原性能阈值有 13 项超限，不能记为验收通过；Windows 的构建、HMR、headless 和 Dimina 失败已定位到上述 Sass embedded 官方包缺件。另两类失败分别来自完整入口扫描缺少诊断，以及环境单测仍要求合并 stdout/stderr。当前实现保留完整扫描语义和分流收据，迁移对应断言，没有放宽性能或产品完整性检查。两阶段提交均已通过原生 hooks 并推送 `main`，远端身份已回读。

本阶段 owning-package 类型检查、构建及公开类型检查通过；完整公开类型矩阵为 88/88 个 Turbo 任务成功、0 个命中缓存，包含前置构建。uni-app 兼容缓存及终结路径的 33 项回归、本地候选的 28 项回归、完整扫描与惰性构造的 105 项定向回归，以及真实 auto-import watch 的 5 项回归均通过。下游 apps/templates 构建为 80/80 个任务成功、37 个命中缓存；网站使用实际 `website-weapp-vite` 选择构建通过。一次错误的 `website` 选择没有匹配任何项目，虽命令退出 0，未计为通过；随后使用 `--fail-if-no-match` 和正确包名重跑。

原 12 场景的 HMR 复测在本阶段源码上全部执行并通过：runtime demo 745–767 ms、uview 3707–3814 ms、wot 3104–3181 ms，实际均为 classic，原 baseline 和阈值没有变化。161 个候选文件在额外 CPU 诊断前后哈希一致。该诊断在单进程预热后完成 runtime native/Vue 与 wot Vue 各三个采样窗口，保留 V8 profile 和整个进程 CPU 记录；诊断不计入正式性能门禁，也不把主 isolate profile 当作 Rust 工作线程证据。临时脚本首轮漏传独立 profile 输出路径，停在预热、没有采样；原失败保留，通过精确恢复 API 核验源码、CLI、Inspector、配置及空 IDE journal 后释放租约。修正路径后的整轮诊断退出 0，源码、连接、进程与租约均正常收尾。

本阶段依赖生命周期首轮的 Vite 与 Rolldown 均通过既定适用合约，Chokidar 为 28/29 项通过。唯一失败在第一次删除目录后未收到原生事件，尚未进入冷却或第二代检查，全部资源已完整清理。该场景仅等待公开 ready，漏用了仓库已有的 Darwin 原生目录注册屏障；修复在首次准备和重建目录之后等待精确屏障，文件重建继续使用既有父订阅。三文件 18 项定向回归通过，保留全部 29 场景、原预算、精确事件链和屏障失败传播，首错报告单独封存。随后完整生命周期合约复验退出 0：Vite 与 Rolldown 的既定适用合约、Chokidar 全部 29/29 场景均通过，清理已确认；原固定版本例外没有扩大。新候选完整门禁继续记录。

最新依赖审计图为 2917 项，仍有 low 6、moderate 19、high 17、critical 8，审计退出 1；未通过不兼容 override 消除告警。较早的完整单测、完整 headless、局部 IDE 和浏览器结果保留各自候选身份，本阶段源码变化后的正式完整验证仍待完成。根工作树完整 HMR 曾有一个项目因历史未知归属的 IDE asset journal 未启动，旧记录不删除或改写；新候选改在干净隔离工作树执行完整 HMR，正式 IDE 继续仅从同步且干净的根 main 启动。

第三阶段候选 `daa723d2b4cfbca74d58b84fd90651900ac2fe1f` 已通过原生 hooks 提交并推送。该候选完整单测为 2,638 文件、25,594 用例通过，保留原有 13 文件、20 用例跳过；161 个候选文件与原 baseline 均无漂移。完整干净隔离树连续两次离线冻结安装通过，包构建 49/49 个 Turbo 任务成功，47 个命中缓存。

随后该候选完整 Workspace HMR 退出 0：76 个项目、233/233 场景实际执行并通过，全部 classic，原阈值独立复算无告警。此前遗漏的 `vite-native-ts` 三场景均完整执行；runtime 最大 905 ms、uview 最大 4097 ms、wot 最大 3430 ms。233 个正式 profile、466 对修改与恢复发布关联、152 个原始证据文件及 830 个 timeline 边界均独立核验。37,980 个 tracked 文件哈希无漂移，根树历史 journal 原样保留，进程、配置与机器租约已释放；独立工作树在证据保存后按精确归属移除。

同一候选的远端完整 HMR 行为仍为 233/233 通过，但原性能阈值有 9 项超限：runtime native script 1613/1500 ms，uview 6509–6810/6000 ms，wot 5007–5246/5000 ms。不能用本机通过覆盖远端失败。已核验新 artifact 的候选身份和完整 digest；Vue 资产计划缓存全部命中，剩余成本按实际输入身份和调用边界继续处理，不扩大缓存寿命或调整原 baseline。新修复令普通脚本的归属检查和同步通知共用现有同步解析作用域，发布阶段直接消费通知边界已捕获的 canonical 身份；新增符号链接改指、删除重建、观察释放及冻结身份回归，保留下一次操作重新解析和异步输入原有校验。

该候选的 Windows Miniapp 两个 output-mode-sequence 构建用例本身均通过，失败来自导入时无条件启动的 PowerShell 预热 Promise 在 30 秒后产生无人等待的 rejection。预热改为首次真实资源采样时创建，并发观察共享结果与错误，保留原 30 秒预热、10 秒查询预算，不吞错或重试。另一个 Windows coverage 失败发生在真实 Git 夹具的复合场景 5 秒预算内；没有逐 Git 阶段证据，不能断言唯一慢因。该文件此前落在普通并行组，现纳入已有子进程串行组，原测试及预算不变，完整发现范围继续校验。上述后续修复的实际 HMR 与 Windows CI 结果仍待记录，不能追认为第三阶段完整验收。

第四阶段的输入身份回归为 7 文件、62 用例通过，Windows 预热回归为 4 文件、41 用例通过，Git 夹具与串行发现回归为 2 文件、11 用例通过；weapp-vite 包级类型、重建与公开类型均通过。随后原 12 个 HMR 场景全部执行并通过行为、恢复和原阈值，实际 classic：runtime 752–775 ms、uview 4190–4468 ms、wot 3408–3495 ms。170 个候选文件哈希不变，机器租约和进程正常释放；此轮耗时与此前相近，不宣称已改善整体性能或通过远端阈值。

补充 uview 预热后三个 CPU 采样窗口，均在同一进程中完成，诊断退出 0、源码无漂移、资源全部收尾。产品 realpath 的采样墙钟均值约 1037 ms，占约 4131 ms 的 edit-to-formal 窗口四分之一；config 路径规范化约 495 ms、source 规范化约 329 ms、protocol 规范化约 199 ms。首段 Profiler 初始化间隔单独排除，未累加父栈或将整进程 CPU 当作 Rust 工作线程证据。该诊断未采集实参和精确调用次数，不能证明全部 realpath 可缓存；保持操作、异步、配置和符号链接的原失效边界，后续以新候选原门禁的实际结果判断。

后续核对发现，外部组件的输出路径规划先判断源码根，再映射外部命名空间，两个步骤重复解析同一目标及其成功父目录。修复仅将该同步操作纳入既有路径作用域，继续通过 receiver 的相对路径方法分派，不缓存失败目标、不跨异步或 generation 保存。4 文件、39 用例验证成功解析复用、同操作创建文件、缺失路径重新探测、符号链接改指及配置根更新；两路径 ESLint、weapp-vite 包级类型和重建通过。已有超过 300 行的配置编排文件保持职责边界，本次仅增加作用域包装，独立路径回归置于相邻文件；没有借此扩展全局缓存。完整门禁和远端性能尚未据此宣告通过。

继续完整读取远端 Windows coverage 发现，Node 24 的 changeset 暂存检查和 pre-push 快照夹具也在普通并行组触及默认 5 秒预算；两项纳入同一个既有子进程串行组，完整发现清单及预算保持不变。快照夹具另存在超时后异步 worktree 操作未排空就删除目录的清理竞争，现复用已有 FixtureLifecycle，将 Vitest 取消信号传至正式快照 API 和 Git，清理先等待完整工作链结束。4 文件、52 用例及三路径 ESLint 通过，产品快照实现未改；Windows 远端是否恢复仍待新候选验收，两个 coverage 汇总失败保留为其 shard 失败的后果，不另外改写门禁。
