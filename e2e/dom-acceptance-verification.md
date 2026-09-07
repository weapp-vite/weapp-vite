# 微信 IDE DOM 验收规范与覆盖记录

## 范围

`ide-full:exhaustive` 包含 89 个任务，微信范围为 86 个任务；3 个可选百度任务标记为范围外。当前 manifest 展开 223 个 case 声明，全部注册 DOM 验收计划，未发现缺失计划、未解析参数表或没有 case 的微信任务。

以上数字表示静态接入，不表示测试通过。逐任务、fixture、路由、操作与计划来源见 [生成清单](./dom-acceptance-inventory.md) 和 [JSON 清单](./dom-acceptance-inventory.json)。新增 case 后重新运行生成器，不手工编辑清单。

## Case 契约

每个 case 开始时通过 `createDomAcceptance` 注册独立期望与有序检查点。模板、聚合与参数化入口必须展开所有子 case；一个 case 内的多路由场景需要分别检查首屏及关键操作后的实际节点。

检查内容包括文本、属性、数量、条件节点出现或消失，以及组件内部作用域。`page.data`、`runE2E().ok`、构建文件、dataset 和根节点存在不能单独证明界面正确。API、生命周期与事件场景应把实际执行结果呈现在 fixture 界面，并保留原语义断言。

样式验收使用真实 IDE 的计算样式与布局证据。`rpx` 期望结合本次宿主窗口宽度换算，保留窗口证据和宿主取整容差；headless 的逻辑树不提供计算样式或布局验收。查询异常和缺失查询能力必须失败，只有成功返回空集合才支持节点不存在的结论。

HMR 场景在修改前定义所有阶段期望。同一路由保留当前页面并验证更新内容及交互状态；切换路由使用同一 automator 的 `reLaunch`。独立启动需要说明原因。运行态失败不能降级为检查 dist 后记为通过。

`classic` 与 `stateful` 分别登记预期：classic 脚本/WXS 引起完整刷新时，先检查刷新后的首屏，再复用会话导航并验收新代码；模板局部更新仍验证原页面状态。stateful 场景检查计数、共享 store、响应式删除状态和新增默认值，不能通过重新导航或恢复测试数据来满足保状态断言。DOM 采集前后必须属于同一真实页面身份，避免同路由替换时误用旧页面证据。

预期错误按检查点精确登记来源、级别、通道、文本与次数，通过 `act` 绑定操作边界；其他错误、缺失错误、多余错误及边界外错误均不能消费。错误日志仍保留在报告中，具体接口见 [检查点说明](./utils/domAcceptance/README.md)。

## 严格报告

报告记录 run、invocation、提交 SHA、provider、IDE 和基础库版本，以及逐 case/checkpoint 结果。套件区分通过、失败、阻塞、跳过、未执行和范围外。缺失证据、错误路由、过期证据、查询异常、skip/todo、环境阻塞或提前终止都不能得到完整通过结论。严格验收完成时还要求运行日志渠道已配置且文件存在；空日志可以表示没有错误，缺失渠道不能表示没有错误。

筛选或断点运行只产生局部结果。模板子调用必须完整且无重复；aggregate 导入必须与 manifest 的子任务一致。最终验收需要在最终提交上无筛选运行 `pnpm e2e:ide:full:exhaustive`，同时满足 `pnpm test`、`pnpm e2e:ci`、`pnpm e2e:ide:full` 和适用 CI checks 全部完成且通过。

严格任务结束后还会将实际收集的模块与 case 名称逐项对照源码声明清单。聚合遗漏、同数量替换、重复 case 或错误模块不能因为剩余测试通过而得到成功结论；参数化 provider 标题和模板子调用在比较前明确展开。

运行证据保留在本机报告目录，PR 仅提供脱敏摘要与证据索引。报告中的项目路径、用户目录、凭据和邮箱由统一工具脱敏。静态清单只记录实际调用路径上可识别的计划接入；未调用的局部 helper 不计入覆盖，运行时 reporter 仍是执行完整性的判据。

## 云端 Headless 覆盖

`ide-dom-headless` 只接入已有 headless 通过报告的任务，不据新增 DOM 计划推断 provider 兼容性。目前清单为 16 个任务、36 个 case：

| 分组                                                         | 任务数 | Case 数 | 已有证据索引                                                                                   |
| ------------------------------------------------------------ | -----: | ------: | ---------------------------------------------------------------------------------------------- |
| app prelude、自动路由、React、Wevu behavior/router、4 个模板 |      9 |      26 | run `73a9dab2-76fe-488e-88d2-3c85bd429059`                                                     |
| Wevu 模板布局、3 个 chunk 矩阵、complex A/B 分包             |      5 |       7 | run `faae4885-4035-45ea-aeb6-c9653b682f9f` / invocation `c356ee1b-8714-40bd-827f-3985ac738ab9` |
| TDesign 弹窗两种导入、Wevu 组件 emit                         |      2 |       3 | run `6c674ce1-4221-4b49-90f2-cd9b2b80066a` / invocation `70adf223-c04d-4cf0-ae3a-fa60f3996616` |

这些是加入 CI 的历史运行依据，不是最终提交验收。后续源码或 fixture 变化仍需重建并重新执行对应 provider。HMR 和真实网络宿主场景没有因为静态计划接入而加入本清单；headless 尚不能覆盖的行为保留真实 IDE 验收与对应的 mpcore 回归。

最新完整 headless 运行 `7ff712c9-6cd0-4d39-8e20-2f922493f4a3` 已通过全部 16 个任务、36 个 case、142 个检查点，无失败、跳过或缺失检查点。该运行包含严格日志渠道检查，仍来自未提交工作区，不能代替最终提交上的真实 IDE 验收。云端三个新增验收任务组均在 PR 使用 Node 22，手动与定时完整运行覆盖三个 OS 的 Node 22/24。

### 真实网络与模拟请求边界

请求组 headless 局部运行 `a215e2b1-4827-4ee8-9de3-c71abc6dfef0` / invocation `d8feb56f-8471-4286-8465-da0c9a39154f` 共 16 个 case，仅 5 个通过、11 个失败，该运行不通过。`wevu-runtime-demo.request-globals` 的 2 个 case 与 `vue-query` 的 1 个 case 完成了其 DOM 检查；这不表示 `request-clients-real` 和 `request-clients-real-native` 两套真实网络场景通过。

当前 headless 的 `wx.request` 仅匹配显式注册的 response mock，不会转发到本地 HTTP 验证服务器。严格模式在未匹配时抛出 `No request mock matched in headless runtime`；非严格模式只调用失败与完成回调，也不会联网。`wx.connectSocket` 尚未实现，因此 WebSocket、Socket.IO 握手、服务端随机消息和真实 HTTP 往返仍需真实 IDE 验收。服务端已经监听成功不能消除这些 provider 能力限制。

对应的 mpcore 回归保留模拟请求覆盖：`test/requestMocks.test.ts` 在 Node 与 browser session 中检查请求方法、body、header、状态码、回调顺序、取消与未匹配失败；`e2e/requestMocks.e2e.test.ts` 在浏览器中检查请求中节点消失、响应文本与状态码出现、取消错误呈现、失败时没有成功节点。共享 fixture 位于 `test/helpers/requestMocks.ts`。这些路径均相对 `mpcore/packages/simulator`。

上述回归只证明 `wx.request` 模拟回调经 `setData` 后的渲染语义，不能替代 fetch、axios、graphql-request、vue-query 与真实 HTTP 服务交互，也不能证明 socket 传输或真实宿主兼容性。不得给真实网络 suite 注入 mock 后记为通过，不得静默开放默认联网。能力尚缺时保留原 IDE 断言、失败运行和未验收项，不把这两套任务加入 headless 已通过清单。

真实 WebSocket fixture 现在分别等待欢迎帧、本次请求的 echo、独立服务端推送和关闭事件，检查 echo 的 run 与本次发送一致，以及最终 readyState 为 3。推送不能代替缺失的 echo。共享校验器的 simulator 单测覆盖帧顺序、错误请求、解析失败、超时、提前关闭和清理；浏览器回归验证消息结果经页面更新后实际呈现。这些回归仍不代表 headless 已实现真实 socket 联网。

最新真实 IDE 请求运行 `3d0ee255-cd1f-4e09-be79-0aec085ed956` 完成 Vue 与原生两组，共 13 个 case、29 个检查点通过。此前运行 `a866b71d-7d92-448f-92ef-681a09abb23e` 的原生 Socket.IO 首屏验收读到主页路由并失败，失败检查点关联了白屏截图。后续两次原生运行通过，但尚未确认首次路由异常的根因，不能把重跑通过描述为该瞬时问题已修复。

## IDE 项目能力缓存恢复

`apps/layout-power-demo` 曾在 `wv open` 后出现 `Cannot read properties of undefined (reading 'MaxSubPackageLimit')`，模拟器无法显示页面，automator 的当前路由为空。IDE 的项目配置面板同时显示全部包大小额度为零。这类启动错误需要检查项目能力初始化，不能通过删除 `app.json` 中的 `subPackages` 或改用另一个临时项目来宣称原项目通过。

CLI 的旧信任预热流程会在首次导入前创建只有 `projectid`、`projectpath` 和 `isTrusted` 的本地项目记录。IDE 会把缺少的 `attr` 初始化为 `{}`，随后编译器读取 `attr.setting.MaxSubPackageLimit` 时失败。修复后，CLI 仅更新 IDE 已完整导入、包含 `appid` 和 `attr.setting` 的现有项目记录；缺失、损坏或半初始化记录保持原样，首次导入交由 IDE 处理。回归测试覆盖未创建项目索引、未生成另一种存储格式，以及已有能力信息不被覆盖。

对已经存在的异常项目，使用 IDE 的正常界面恢复并记录每一步：

1. 打开目标项目，记录编译错误、当前路由和模拟器状态。
2. 打开顶部「详情 → 项目配置」。进入此标签会重新请求项目能力，也可点击「域名信息」标题右侧的刷新图标。
3. 等待包大小额度从零恢复为有效值，关闭详情并点击「编译」。
4. 重新读取当前路由，检查目标页面的实际节点，并保存恢复前后的截图和错误信息。

本轮通过 Computer Use 观察到：刷新项目配置后额度恢复，重新编译后路由变为 `pages/index/index`，模拟器显示真实布局页面。恢复过程没有删除或修改 IDE 私有缓存，也没有手工补写 `attr`。本机证据索引为 `docs/reports/dom-acceptance/ide-cache-recovery/layout-after-project-config-refresh.png`。

该观察只证明项目能力刷新与页面恢复。手工 `wv open` 时未启动开发服务器，Console 中仍有对应开发服务请求失败；这些残留错误不能作为正式验收中的预期错误自动忽略，也不能据页面恢复就将 case 标记为通过。后续必须先重建 CLI 相关包，再通过正式 `dev -o` 场景验证启动、DOM 检查点、HMR 和错误报告。

## 本轮阶段性验证

以下结果来自尚有未提交改动的诊断工作区。所列 IDE 报告均记录 `workingTreeDirty: true`，其提交字段不能代表本次改动的最终提交；局部通过项不构成全量验收或 PR CI 通过。

- `pnpm test` 最新完整运行通过：1236 个文件通过、12 个文件跳过；11867 个测试通过、19 个测试跳过，退出码为零，包含新增 WebSocket 消息与日志桥生命周期竞态回归。已修复先前的 simulator 自定义事件目标断言及独立快照上下文的旧 mock；跳过项属于原有单测范围，不能用来豁免严格微信 DOM 验收。
- E2E 内部工具最新完整运行通过：41 个文件、360 个测试，包含缺失日志渠道、普通 `ide-full` 默认严格验收、局部运行不得完整通过和原生 PTY 的回归。微信、支付宝和抖音 runtime 平台构建快照的 3 个测试也全部通过，7 个页面的快照已同步业务 DOM 节点。此前 `e2e:ci` 诊断运行发现快照失败后被主动终止，不能计为完整通过。
- 修复快照后，无筛选的 `pnpm e2e:ci` 已完整通过 75/75 个任务，退出码为零。其中完整 HMR guard 的 26 个子任务，以及自动导入、自动路由、共享 chunk 专项均通过。验收索引为 `2026-09-07-164003-e2e-ci-8837ec26-suite-report`；这仍是未提交工作区的结果，后续改动需重新验证受影响范围。
- `pnpm e2e:ci` 不包含独立的 `pnpm audit:hmr:changed`。旧 CI 的 lifecycle-compare、wevu-features 和 Wevu 模板审计曾在等待 Vue script 更新 marker 时失败；修复更新批次判断后，三个项目已分别通过独立审计，详见下文复验记录。完整云端 workspace audit 仍待最终提交验证，不能由 HMR guard 或局部审计通过推断全部审计通过。
- 无筛选的普通 `pnpm e2e:ide:full` 运行 `1c0c3955-31ec-4bc3-ab1f-2f6e6904ba65` 在第 3/18 个任务失败后停止，不能记为完整通过。生命周期和自动路由任务通过；CLI 打开、截图与 DOM 点击 case 通过，开发快捷键 case 在启动时遇到 `script: tcgetattr/ioctl: Operation not supported on socket`，两个 DOM 检查点均未执行。该失败发生在伪终端初始化阶段，尚未启动开发进程；保留失败报告并修复测试启动器后重跑。
- Tailwind 与 JSX 真实 IDE 局部运行：run `3d541a7f-645c-4008-80a9-3c717bb3897f` / invocation `ce9fd28a-2f7e-486a-8c49-a07ba044e8bd`，3 个 case 中 2 个通过、1 个失败。原生与 Wevu 两个 Tailwind TDesign 模板的 HMR 检查完成，包含实际计算样式、布局与交互状态。JSX/TSX 仍失败：`tsx:page-updated` 期望 `pages/tsx-basic/index`，实际变成 `pages/jsx-basic/index`，不能把前面已通过的检查点算作该 case 通过。
- Core 与 runtime vendor HMR 局部运行：run `8ae667fa-7e1a-4c92-885d-daee9e9ec5ae` / invocation `fe081526-1b4b-4a2a-ba78-db898d96e33c`，2 个 case 均失败。Core 的诊断显示，同次更新后 `routeOnly` AppService 方法仍返回 `LAYOUTS-PAGE-SCRIPT-BASE`，原生 `Page.callMethod` 返回 `HMR-IDE-CORE-LAYOUT-PAGE-SCRIPT-WEAPP`。此差异要求按真实页面身份检查调用来源并继续验证，不能由原生方法读到新值推断后续 DOM 和完整 HMR 矩阵通过；vendor case 同样保留失败状态。
- 公开类型：修复 tsd 默认漏跑后，`pnpm --filter @mpcore/simulator test:types` 与 `pnpm --filter @weapp-vite/miniprogram-automator test:types` 均完成构建并显式执行全部 `test-d`，退出码为零；覆盖新增页面身份、导航与 XPath、渲染通知参数等契约。此结果仅证明本轮类型检查通过。

IDE JSON 证据分别位于 `docs/reports/dom-acceptance/<run>/<invocation>.json`。最终交付仍须在最终提交上完成无筛选全量 IDE 验收，重新确认三项主命令与所有适用 CI checks。

## JSX 状态保持 HMR 后续验证

真实 IDE 的页面补丁曾触发 `No factory registered for module ...internal-template.mjs`。初始构建将重导出直接折叠到 runtime chunk，独立的 template chunk 虽已生成，却未被入口加载；后续补丁仍按原始模块图初始化该依赖。仅检查补丁文件生成与 HTTP 发布无法发现此错误。

`packages/weapp-vite/test/runtime/jsxStatefulHmr.test.ts` 现执行初始 bundle、真实 Rolldown runtime 和连续两批补丁，覆盖从共享片段到页面事件的完整更新。修复在原生加载层登记主包内孤立非入口 chunk 的惰性加载器，使用生成代码中的真实模块 ID，保留新工厂优先、循环检测与旧 chunk 覆盖保护。分包边界来自扫描服务的完整结果，覆盖仅在 app 配置或自动路由中声明的分包；AST 查询排除动态属性调用。分包与页面入口不进入该映射，产物仍由 Vite 写入。

客户端错误信息和堆栈分别限制长度，为 JSON 转义和 UTF-8 编码预留请求预算。回归将包含控制字符、中文、引号与反斜杠的超长错误送入真实 transport：修复前返回 400 且不执行重建，修复后返回 202 并执行重建。诊断文本不能让恢复指令超过服务端 64 KiB 限制。

最新局部真实 IDE 运行 `2b142d1a-cb92-49dd-9439-c6de5ad248cb` / invocation `cce929dd-8c23-4872-b110-f47ecccd0d9b` 已通过 1 个 case、5 个 DOM 检查点。页面标题、共享文本与计数 `0 → 1 → 3` 符合预期，Page/App 身份保留，客户端版本 `0 → 1 → 2`，无运行时错误。热更新后的 `getCurrentPages()` 路由代理仍可能返回旧数据，计数语义断言使用原生 `Page.getData` 且关闭 fallback，同时保留真实 DOM 检查。

Core HMR 在 `7d051c26-c16a-42ed-9f6c-966702394612` / `c0013ee6-468d-4329-a0ef-bc2ff219bf08` 中通过；layout vendor HMR 在 `331f6f85-c227-4a52-b283-b307bece0525` / `c324a6b3-7010-49ee-adc6-705cc919673e` 中通过。这两次混合分组运行仍包含其他失败 case，整体报告不通过。

上述证据均记录 `workingTreeDirty: true`，只能证明相应局部修复，不代表最终提交全量验收。验收身份已区分新生成的报告与源码改动；已跟踪报告的修改仍会标记 dirty。开发日志同时收集客户端重建原因及连续堆栈，防止应用重启丢失异常后被误记为无错误。

## CLI 快捷键与独立 HMR 审计复验

CLI 快捷键测试使用原生 PTY 直接启动 Node，拒绝降级到普通管道。真实进程回归覆盖无需换行的按键输入、启动提前退出和强制清理；测试进程的日志等级显式启用 info，避免继承 Vitest 测试环境后隐藏就绪提示。`dev -o` 的就绪提示早于 IDE 自动化端口初始化，测试复用 `waitForOpenedAutomator` 等待本次打开的会话，不重新启动项目。

真实 IDE 进一步暴露日志桥竞态：截图暂停时，后台日志桥尚在连接，旧实现会直接返回；稍后日志桥才开始占用会话。修复后暂停等待待完成连接，恢复也纳入同一生命周期，关闭后不能再恢复或并行建立第二条日志桥。四项单测先失败后通过，相关日志桥与快捷键单测、包级 typecheck 均通过；修改后已重建 CLI。

复验 run `fb9110c2-e21f-4ea0-b135-00009c4524dc` / invocation `114bcdad-fdbf-49a7-b220-ed5ca6c2ebd1` 中两个 CLI case、五个 DOM 检查点全部通过。真实按键完成整页截图，截图前后均检查目标页计数为 0；CLI 和 MCP 点击分别检查计数为 1、2。该运行有筛选，套件仍为局部结果并返回非零，不表示完整 IDE 验收通过。Computer Use 的失败后页面截图保留在 `docs/reports/dom-acceptance/cli-hotkey-diagnostics/after-fullpage-timeout.png`，显示目标路由和正常业务界面；单独截图诊断中无开发服务的旧 HMR 产物启动失败不计为本 case 通过证据。

三个旧 CI 失败项目已分别通过独立 HMR 审计：lifecycle-compare 的六个场景、wevu-features 的三个场景和 Wevu 模板的三个场景均观测到实际产物更新，无场景错误。使用 `pnpm audit:hmr:nightly` 加各项目的 `WORKSPACE_HMR_FILTER` 复验；完整云端 workspace audit 仍须在最终提交上通过。

## 维护命令

```sh
node --import tsx e2e/scripts/domAcceptanceReport/inventory.ts --write
node --import tsx e2e/scripts/domAcceptanceReport/inventory.ts --check
node --import tsx scripts/check-e2e-ide-shared-launch.ts
pnpm exec vitest run -c e2e/vitest.e2e.internal.config.ts e2e/scripts/domAcceptanceReport e2e/utils/domAcceptance
```

`--check` 同时验证清单新鲜度和完整性；重新生成一个缺计划的清单不能使检查通过。工具层回归覆盖遗漏计划、错误路由、过期证据、查询异常、聚合遗漏、skip、提前终止、局部运行、预期错误消费和路径脱敏。

所有本机 E2E 全局串行；先检查残留进程，长任务保持系统唤醒。修改源码后先重建受影响包，CLI 下游验证先执行 `pnpm --filter weapp-vite build`，再执行 headless 与真实 IDE。本文尚不宣称真实 IDE 全量验收或 PR CI 已通过。

公开类型验收必须执行真实 `test-d` 文件。当前 tsd 版本的默认文件推导仅替换 `.d.ts`，遇到 `.d.mts` 会误将声明文件本身作为测试，不能据默认 `tsd` 返回零认定契约通过。simulator 与 automator 的 `test:types` 已显式指定 `--files "test-d/**/*.test-d.ts"`；需要复用已同步的 dist 而不触发构建时，使用 `pnpm --filter <package> exec tsd --files "test-d/**/*.test-d.ts"`。类型测试使用公开 `HeadlessWx`、session 和 page handle 契约，不通过页面任意字段的 `any` 访问验证宿主类型。
