# 微信 IDE DOM 验收规范与覆盖记录

## 当前结论与范围

本文件保留验收规范和提交前的诊断记录；**交付状态以 PR 中绑定最终 SHA 的验收摘要和云端 checks 为准**。下表和历史索引保留局部通过与失败证据，不能据此宣称最终提交上的全量 IDE 或 PR CI 已通过。除明确标记的已提交运行外，本轮诊断报告来自未提交工作区；`workingTreeDirty: true` 时，报告中的 SHA 不代表这些修改已经进入该提交。

最新静态清单为 **91 个任务、88 个微信任务、3 个范围外百度任务、226 个展开 case**。226 个 case 均注册计划，缺计划、未解析参数化和没有 case 的微信任务均为零。数量变化来自新增结算和组件实例 API 正式场景；临时组件 API probe 已移除。组件库和人工 IDE 示例仍按原 manifest 排除。

这是源码接入完整性，不是执行结果。任务、fixture、路由、操作和计划来源见 [生成清单](./dom-acceptance-inventory.md) 与 [JSON 清单](./dom-acceptance-inventory.json)。清单由源码生成，不手工维护统计值。

## 验收规范

| 契约          | 必须满足的条件                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case 与检查点 | 每个 case 通过 `createDomAcceptance` 定义独立期望和有序检查点；聚合、参数表、模板子调用与多路由场景全部展开。首屏及关键操作后都检查实际节点。                                                |
| 业务 DOM      | 检查文本、属性、数量、出现/消失及组件作用域。`page.data`、`runE2E().ok`、构建文件、dataset 或根节点存在不能单独证明业务界面正确。API/lifecycle 结果须呈现在 fixture 界面，同时保留语义断言。 |
| 查询失败      | 能力缺失、协议异常或查询失败必须失败；只有成功返回空集合才证明节点不存在。优先语义 ID 和声明者作用域，避免依赖原生查询桥不支持的位置伪类。                                                   |
| 样式与布局    | 使用真实 IDE 的计算样式、布局及本次窗口证据。headless 逻辑树或模拟尺寸不能作为布局通过证据。                                                                                                 |
| HMR           | 修改前声明全部阶段期望。stateful 保留页面/App 身份、计数和共享状态，不通过重新导航或恢复数据满足断言；classic 完整刷新时先验首屏再导航。DOM 采集前后必须是同一真实页面身份。                 |
| 会话与启动    | 同 app/suite 复用 automator，通过 `reLaunch` 切路由；独立冷启动写明原因。等待初次完整构建后启动，产品 HMR 直接观察原项目；启动期间保留被动监听和唯一限时日志订阅，不清空 Console。           |
| 错误归属      | 预期错误按检查点精确声明来源、级别、通道、文本与次数，用 `act` 绑定边界。未分类、多余、缺失及边界外错误均不得消费。接口见 [检查点说明](./utils/domAcceptance/README.md)。                    |
| 严格报告      | 记录 SHA、provider、IDE/基础库版本、case/checkpoint 结果和证据索引，区分通过、失败、阻塞、跳过、未执行及范围外。缺证据、错路由、过期证据、skip/todo、环境阻塞或提前终止不能完整通过。        |
| 完整性        | 执行收集的模块与 case 名称逐项匹配源码声明，拒绝聚合遗漏、同数量替换和重复。筛选、断点及允许失败的诊断运行均为局部结果；运行日志渠道必须存在，缺日志不能当作没有错误。                       |
| 证据与隐私    | 完整 JSON、截图和日志留在本机，PR 只提供脱敏摘要与索引。项目路径、用户目录、凭据和邮箱统一脱敏；源码及共享 helper 改动后重新生成包含内容摘要的清单。                                         |

本机 E2E 全局串行，启动前检查残留进程，长任务保持系统唤醒。修改源码后重建受影响包；CLI 下游验证固定先运行 `pnpm --filter weapp-vite build`，确认 dist 同步后再执行 headless 和真实 IDE。任何最终 bundle 都由 Vite/Rolldown 输出，不手写 dist 修补。

产品 HMR 场景调用 `launchAutomator` 时必须在参数对象中显式指定 `bridgeProjectMode: 'direct'`，让 IDE 直接观察 Vite 写出的原项目。仅 `automator-bridge-wrapper-hmr.runtime.test.ts` 使用 `'snapshot'`，专门验证桥接快照。`layout-power-demo.runtime-vendor-hmr.test.ts` 经 CLI `dev -o` 和 `waitForOpenedAutomator` 连接原项目，是已审查的独立入口。内部 AST 守卫 `e2e/scripts/hmr-launch-mode.test.ts` 检查所有 `e2e/ide/**/*hmr*.test.ts` 及另列的 `forward-console-demo.runtime.test.ts` 调用，拒绝缺失、动态值和被后置展开覆盖的模式；新间接入口须单独审查，不从任意 dev 进程推断模式。

本仓库 fixture 已获授权运行时，在启动测试进程前将 `WEAPP_VITE_E2E_TRUST_PROJECTS` 设为当前仓库路径，或仅列出已授权的 fixture 根目录。该选项匹配原始 fixture 路径，再把明确的 `trustProject=true` 传给 IDE `/auto`；不修改全局安全设置。snapshot 每次生成新项目目录，旧目录的信任状态不会继承；未准备信任时，自动化端口可已连接而模拟器仍停在信任提示，不能将首屏超时记为业务通过。

同一正式 HMR 场景的七个检查点在桥接快照模式失败、原项目模式连续两次通过，说明启动观察面会影响验收。快照还会合并 private config，因此不能把差异仅归因于 `fs.watch`。最终仍须在正常运行的 HMR 客户端下检查首屏、每阶段 DOM/计算样式及应保留的交互状态；停止客户端后的隔离 probe 只能辅助诊断。

## 已提交版本复验与当前阻塞

后续提交 `672b1b31ce5d801896e131ddd13a306b534ba907` 的干净工作树完成 `pnpm test`（1293 files / 12275 tests，原有 12 files / 19 tests 跳过）、`pnpm e2e:ci`（75/75 tasks）和严格 headless（20 tasks / 40 cases / 153 checkpoints），均退出 0。索引分别为 `.tmp/final-672b1b31c-test.log`、`docs/reports/2026-09-08-114846-e2e-ci-f6d71d01-suite-report/index.json`、`docs/reports/2026-09-08-115127-e2e-ide-dom-headless-2c45e292-suite-report/index.json`。独立 headless 审计通过 947 个 selector、229 份源码摘要。

该提交首轮 full 在 Wevu TS 首屏超时，报告 `2026-09-08-115320-e2e-ide-full-ce47a0ae-suite-report`；Computer Use 确认新的 snapshot 目录停在信任提示，确认运行后首屏立即呈现、Console Errors 为 0，截图保存在 `.tmp/lifecycle-trust-prompt/`。使用上述限定目录选项后，原生命周期场景的 1 case / 6 checkpoints 正式复验通过；该环境问题与此前取消工具缺口分别记录，不能混为同一根因。

同一干净提交的下一轮 full 完成 11 个任务，在 stateful HMR 的 Component case 等待客户端版本 3 时观测到版本 4，DOM 只完成该 case 前 2/4 检查点；另 6 个任务未执行。报告 `2026-09-08-121820-e2e-ide-full-6c0f3c8a-suite-report` 保留失败。该场景随后一次无改动、五次带临时 DevEngine 记录的定向复验均通过；五轮各产生 3 个有序 Patch，未证明重复投递，临时源码已恢复并重建。

独立检查发现测试保存工具先移走旧文件再原位写新文件，暴露缺失、空文件及部分写入窗口，不符合原子保存语义。保存工具改为同目录完整预写后 `rename` 替换；故障回归验证发布前旧内容完整、失败保留旧文件、最终新内容完整及临时文件清理。保留原版本、DOM、身份和交互状态断言，后续新提交仍须完整验证；不能将上述局部通过拼接成 full 或 exhaustive 通过。

提交 `5d7216a0d71226cbf9214156f967ff3719d2a72f` 的干净工作树已完成以下无筛选验证；这些结果只证明该提交，不代替后续工具修复提交的重新验收。

| 验证                     | 结果                                                                                            | 证据索引                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm test`              | 1289 files / 12252 tests 通过，退出码 0；原有 12 files / 19 tests 跳过                          | `.tmp/final-5d7216a0d-test.log`                                                        |
| `pnpm e2e:ci`            | 75/75 tasks，complete/passed，退出码 0                                                          | `docs/reports/2026-09-08-092342-e2e-ci-75c4df76-suite-report/index.json`               |
| 严格 `ide-dom-headless`  | 20 tasks / 40 cases / 153 checkpoints 全通过；独立审计全部报告、947 个 selector、228 份源码摘要 | `docs/reports/2026-09-08-092610-e2e-ide-dom-headless-669406a7-suite-report/index.json` |
| `pnpm e2e:ide:full` 首轮 | 9 passed / 1 failed / 8 not executed；React 启动超时，未进入 case                               | `docs/reports/2026-09-08-095034-e2e-ide-full-85d0d570-suite-report/index.json`         |
| `pnpm e2e:ide:full` 复跑 | 0 passed / 1 failed / 17 not executed；原生 lifecycle 首屏协议查询超时，0/6 checkpoints         | `docs/reports/2026-09-08-100855-e2e-ide-full-9a2f40e8-suite-report/index.json`         |

React 正式场景在同一干净提交、无源码修改下单独复验，3 cases / 14 checkpoints 全通过，耗时 39.03 秒；报告 `docs/reports/dom-acceptance/135c5e3e-a950-4f4d-a16b-a2c8e1993b63/7f532eaf-301a-4485-96c8-3dc406d525a9.json`。Computer Use 观察到 React 页面实际计数交互有效；原生 lifecycle 超时后也能看到首屏和 `onLaunch/onShow` 结果，Console 错误数为 0。截图分别保存在 `.tmp/react-ide-startup/` 与 `.tmp/lifecycle-warmup-timeout/`。这些是失败后的诊断观察，不能补记为正式 DOM 验收通过。

独立假依赖反例证明启动工具另有取消缺口：外层超时后旧 factory 仍可继续产生副作用；HTTP `/auto` 没有取消信号，能超过声明预算继续等待。反例读取真实 helper，仅使用虚拟计时器、socket 和 fetch，不启动 IDE；见 `.tmp/bridge-cancellation-probe.mjs` 与 `.tmp/bridge-cancellation-probe.json`。它不证明两次 IDE 失败的根因，也不证明存在 OS 子进程泄漏。修复必须维持原有截止时间与断言，统一启动取消、迟到结果和清理所有权，再重新完整验证。

启动工具现由独立 lifecycle 管理总截止时间、每阶段预算、取消和资源交接。bootstrap 通过 IPC 传递取消并等待 helper 退出；helper 取消 HTTP/socket 并清理 CLI 进程树，Windows 使用 `taskkill /T`。迟到会话不会进入后续刷新与 warmup，查询循环不能吞掉取消后继续切页。HTTP `/open`、fileutils reset 和 engine 使用阶段信号，取消后等待请求实际退出才进入恢复；这些约束不能撤销 IDE 已接受的操作，也不保证宿主必定在预算内启动。

SDK `connect` 将 WebSocket 与版本检查放在同一原始预算内，失败时断开尚未交付的连接，不关闭用户项目。CLI HTTP/engine 的可选 `signal` 保留原始取消原因，阻止端口解析结束后、轮询等待中或 fallback 前的迟到请求；公开类型通过 `weapp-ide-cli test:types` 随云端根类型检查执行。新增回归还覆盖计时器尚未触发但单调时钟已经越界的资源交接，以及刷新超时后先退出请求再重试的顺序。

engine CLI fallback 与 automator 的 engine/prebuild 均显式启用 Execa 子进程树清理，避免 Windows 批处理包装进程退出后遗留实际构建进程。取消契约回归保留请求退出顺序及原有阶段预算。

启动取消修复后的提交前严格 headless 运行完成 20/20 tasks、40 cases、153 checkpoints，退出码 0；索引 `docs/reports/2026-09-08-110439-e2e-ide-dom-headless-0eace0d9-suite-report/index.json`。随后原生/Wevu 生命周期与 React 的真实 IDE 定向运行完成 4 cases、20 checkpoints，退出码 0、报告无错误；报告 `docs/reports/dom-acceptance/a87ec1b6-490a-48bd-aea7-1e130531f4e8/3c3711a5-cc67-4569-9775-ff5679af5c8b.json`。两次均为未提交工作树结果，早于最后的子进程树清理增强，不能替代最终提交全量验收。

`e2e:ide:full:exhaustive` 及最终 PR 云端检查仍未完成。下列历史通过与失败记录保留原始提交、工作树和范围边界，不与本节结果拼接为全量通过。

## 历史工作树验证表

以下“局部通过”只覆盖所列文件、provider 和代码状态；后续相关修改需要重验。

| 验证项                          | 已有结果                                                                                                                                                         | 当前边界 / 下一步                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 静态清单                        | 91 tasks / 88 微信 / 226 cases，全部有计划                                                                                                                       | 仅证明静态覆盖；最终生成后执行 `--check` 和 shared-launch 检查。                                                                                            |
| `pnpm test`                     | 生命周期修复后无筛选完整运行 1277 文件 / 12106 tests 通过，12 文件 / 19 tests 跳过，退出码 0；`.tmp/pnpm-test-full-component-page.log`                           | 耗时 279.07 秒，对应本次未提交工作树，仍需最终 SHA 对应确认；原有单测跳过不能豁免严格 IDE case。                                                            |
| `pnpm e2e:ci`                   | 新一轮无筛选完整运行 75/75 tasks 通过、退出码 0；含完整 HMR guard 26/26 及三个专项各 3/3，`.tmp/pnpm-e2e-ci-full-current.log`                                    | run `d6a385a1-67cf-4478-b688-da083a83eb52`，complete/passed，无失败、阻塞、跳过或未执行；对应运行时未提交工作树，仍非最终 SHA 证据。                        |
| `pnpm e2e:ide:full`             | 最新无筛选严格运行 18/18 tasks、118/118 cases、378/378 checkpoints 通过，退出码 0；run `b51385c8-09f8-44b0-bb25-4acde5317aef`                                    | complete/passed；30 份 DOM 报告无验收错误，全部证据来自 devtools-page-frame。工作树 dirty，仍需最终提交证据；旧失败保留历史。                               |
| 三平台构建门禁                  | `E2E_FULL_MATRIX=1 pnpm e2e:platform:build` 完整通过，6 files / 37 tests、35.24 秒、退出码 0                                                                     | 包含 wevu-runtime 的 weapp、alipay、tt；`.tmp/platform-build-full-current.log`。最终提交上的云端门禁仍需完成。                                              |
| exhaustive IDE                  | 历史无筛选诊断执行 86 个微信任务，65 通过 / 21 失败，退出码 1                                                                                                    | 当时使用允许继续收集失败的诊断模式；新清单已增至 88 微信任务，须无筛选、无允许失败选项重跑。                                                                |
| Headless 当前全量               | 严格 19/19 tasks、39/39 cases、147/147 checkpoints 通过，退出码 0，全部报告无错误；run `1124010a-49a3-486c-abab-80fa3f765214`                                    | 生命周期修复并重建后的完整运行；`.tmp/ide-dom-headless-full19-component-page.log`，逐 invocation 见下文。对应未提交工作树，不替代最终真实 IDE 全量验收。    |
| 结算 headless                   | run `ea651762-f9f5-4887-a72a-530254753007` / invocation `5bbb79e4-b564-45a9-a2c6-9b5c80936b35`：1 case、4/4 checkpoints，严格报告 passed、无错误                 | `workingTreeDirty: true`。覆盖首页启动与 1→2→1 件结算；真实 IDE 正式场景仍需完成。                                                                          |
| 组件实例 API headless           | run `dd2430b0-d1d6-406c-a48e-9dd84143a5df` / invocation `b0a03f76-c6d9-4d79-b755-c4e38711349b`：1 case、4/4 checkpoints，严格报告 passed、无错误                 | `workingTreeDirty: true`。真实 IDE 正式场景亦已通过，独立 invocation 见下方六任务记录。                                                                     |
| 门户导航双 provider             | 正式 IDE 与 headless 均为 1 case / 7 checkpoints，严格报告 passed、无运行时错误；run 和 invocation 见下方门户记录                                                | 工作区未提交；同一 IDE run 的 Retail 失败，不能将该混合运行记为通过。                                                                                       |
| Simulator 全量浏览器            | 生命周期修复后 30 files / 66 tests 全部通过，退出码 0；`.tmp/simulator-browser-component-page-full.log`                                                          | 已包含新增 componentPageLifecycle browser；该次未提交工作树完整结果，浏览器尺寸不替代微信布局证据。                                                         |
| Wevu behavior 真实 IDE          | 9/9 cases、24/24 checkpoints，严格报告 passed；run `b2f05324-a979-430a-b41c-ecced7086916` / invocation `12bf032f-9e40-4fc4-b087-2b4a2a80cd45`                    | `.tmp/wevu-behavior-current-ide.log`。simulator 修复后同场景亦 9/9、24/24 通过，保留原真实 IDE 期望；两侧均为各次未提交工作树证据。                         |
| Simulator 组件/页面生命周期     | 基础库 3.17.2 原生探针完成 8 步顺序及实际 DOM/WXML/截图；共享 helper、回归与中文 changeset 已落地，188 项单测、typecheck、lint 通过                              | `.tmp/component-page-lifecycle-probe/index.json`；`.tmp/simulator-component-page-build.log` 重建后 browser 全量和严格 headless 全量通过。根因与顺序见下文。 |
| Simulator 公开类型              | 组件 API 变更后实际 tsd 通过；页面方法目标修复重建 dist 后再次显式执行实际 tsd 文件通过，`.tmp/simulator-page-method-tsd.log`                                    | 页面方法 browser 1/1 通过，`.tmp/simulator-page-method-browser.log`；类型通过不能替代 runtime。                                                             |
| Automator 构建和公开类型        | 日志边界调整后已完成最终重建与实际 tsd：`.tmp/automator-console-final-build.log`、`.tmp/automator-console-final-tsd.log`                                         | 结构化日志已用于后续正式局部 IDE 验收；全量启动/HMR 与最终提交验收仍待完成。                                                                                |
| 类型测试 CI 入口与 @mpcore/test | 新增 CI 类型覆盖回归 6/6 通过，`.tmp/public-type-test-coverage-current.log`；@mpcore/test 显式实际 build + tsd 通过，`.tmp/mpcore-test-actual-types-current.log` | 修复默认 tsd 对 `.d.mts` 的漏跑入口；六项回归为独立验证，不并入前次 pnpm test 统计。最终 PR 类型 job 仍需通过。                                             |
| 原生 lazy HMR                   | 启动订阅 deadline 修复后，正式原配置 1 case / 5 checkpoints 通过、无验收错误；原页面/App 身份、交互状态及真实样式全部保持                                        | run `ebe142be-4441-468d-b40d-60b4d532fca9`，局部总入口因其余 87 tasks 未执行退出 1；本任务 passed，整体 incomplete，仍待最终 exhaustive。                   |
| i18n fixture                    | Vue marker 与构建断言修正后定向构建 2 项通过，`.tmp/i18n-fixture-final-build-recheck.log`；Issue #868 正式 IDE 1 case / 2 checkpoints 通过，无运行时错误         | 独立 invocation 见下方六任务记录。构建另 92 项因筛选未执行，不表示整个构建 suite 通过。修正后的断言禁止残留 marker 并检查实际 behavior 引用。               |
| Retail 全路由                   | 正式 IDE 单任务的 29 路由 / 36 checkpoints 全部通过，运行时错误 0；run 与 invocation 见下方零售记录                                                              | 严格局部总入口退出 1，因为完整范围另有 87 tasks 未执行；该任务 passed，整轮 incomplete，最终提交全量验收仍待完成。                                          |
| PR 云端 CI                      | 远端旧提交的 CI E2E 有失败，本地后续修复尚待最终提交验证                                                                                                         | 最终 SHA 的全部适用自动检查和完整 OS/Node workflow 均需完成且通过；等待、取消或审批中不算通过。                                                             |

### 历史工作树真实 IDE 全量通过

无筛选 `pnpm e2e:ide:full` 完整执行 **18/18 tasks、118/118 cases、378/378 checkpoints**，退出码 0。run `b51385c8-09f8-44b0-bb25-4acde5317aef` 的 suite 为 `strict: true`、`coverage: complete`、`acceptance: passed`，失败、阻塞、跳过、未执行均为 0。主日志 `.tmp/pnpm-e2e-ide-full-current.log`，suite 索引 `docs/reports/2026-09-08-043045-e2e-ide-full-f50958be-suite-report/index.json`。

已逐份读取本次 30 份 DOM 报告：全部属于同一 run、同一 SHA，状态 passed，`errors` 为空；118 个 case 均 passed，有序计划与实际证据的 checkpoint ID 逐一相同且无重复。378 份证据全部来自 `devtools-page-frame`，无 headless 替代。IDE 为 `2.02.2608060`，各 fixture 实际基础库包括 `3.13.2`、`3.16.2`、`3.17.2`，以对应报告为准。报告 SHA `2dc0bce4b4f3b8dcf53b1d6fd46e06bbd7e6dbaa` 且 `workingTreeDirty: true`，因此证明运行时工作树通过，不是最终提交验收。

下表计数覆盖本次 18-task suite；它不等于 exhaustive 的 88 个微信任务。原生 lazy 场景的后续正式修复和独立验收另列下文，不拼接为 exhaustive 通过。30 份独立 invocation 全部由 suite 的逐任务 artifacts 索引，位于 `docs/reports/dom-acceptance/b51385c8-09f8-44b0-bb25-4acde5317aef/`。

| 任务（相对 `e2e/ide/`）                                 | cases | checkpoints |
| ------------------------------------------------------- | ----- | ----------- |
| `app-lifecycle.test.ts`                                 | 1     | 6           |
| `auto-routes-define-app-json.runtime.test.ts`           | 1     | 1           |
| `devtools-cli-workflow.runtime.test.ts`                 | 2     | 5           |
| `github-issues.runtime.aggregate.test.ts`               | 65    | 165         |
| `github-issues.runtime.issue621.test.ts`                | 1     | 11          |
| `github-issues.runtime.issue852.test.ts`                | 1     | 1           |
| `github-issues.runtime.subpackage-item.test.ts`         | 2     | 2           |
| `github-issues.runtime.subpackage-user.test.ts`         | 2     | 2           |
| `lifecycle-compare.test.ts`                             | 4     | 50          |
| `react-runtime-spike.runtime.test.ts`                   | 3     | 14          |
| `shared-styles.runtime.test.ts`                         | 1     | 3           |
| `stateful-hmr.runtime.test.ts`                          | 3     | 12          |
| `subpackage-shared-strategy-complex.runtime.test.ts`    | 2     | 8           |
| `template-dev-open-all.runtime.test.ts`                 | 11    | 11          |
| `template-tailwindcss-dev-open-multi.runtime.test.ts`   | 3     | 3           |
| `template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts` | 1     | 6           |
| `wevu-features.runtime.behavior.test.ts`                | 9     | 24          |
| `wevu-runtime.weapp.test.ts`                            | 6     | 54          |

### 云端覆盖与最终交付

六任务严格 IDE 局部运行 `bcf801f9-4c6c-4d4f-a5ff-2e0607dcc242` 为 **4/6 通过，退出码 1**；IDE 版本 `2.02.2608060`、基础库 `3.17.2`，工作区未提交。这次结果不能作为全量通过：

- wrapper HMR：1 case / 6 checkpoints，通过；invocation `5fdfe9bf-692a-4e3f-91bc-602342390fce`。
- GitHub aggregate：65 cases / 165 checkpoints，通过且无运行时错误；invocation `9d4a25db-6ee4-4469-bca2-028b01f5aa9c`。
- 组件实例 API：1 case / 4 checkpoints，通过且无运行时错误；invocation `fd390ba7-dd1a-4c98-aec3-73f5c29b1f87`。与当前 headless 的关系节点、生命周期、作用域查询和移除/恢复结果一致。
- Issue #868：1 case / 2 checkpoints，通过且无运行时错误；invocation `3106ec4a-b113-4aed-8741-c771d9da07e9`。完整 fixture 的 i18n Behavior 注册错误未再出现。
- Retail：在订单列表首屏期望 7 条、实际 5 条处失败，只完成 21/34 checkpoints；invocation `c2967b8f-b6a1-4053-9fd3-55409b2f5d2c`。随后补首屏与下一页独立验收，并修复后续金额组合 XPath；本次后续路由未执行，最新正式单任务通过见下方记录。
- Portal：7/7 DOM checkpoints 完成，但有三次 `navigateTo:fail timeout`，严格报告仍为失败；invocation `bd0b9ccd-8c1d-4df1-b5a3-ad9739ad0f8d`。结构化 Error 采集恢复了实际错误消息和堆栈；随后已定位并修复导航完成时序，双 provider 正式结果见下文。

新增 Behavior 注册 browser 回归 1/1 通过，索引 `.tmp/simulator-behavior-browser-current.log`。随后 simulator 完整 browser 回归 29 文件 / 65 tests 通过，退出码 0，索引 `.tmp/simulator-browser-full-current.log`；此结果早于最新组件/页面生命周期修复，修复后的 30/66 结果见当前表。此前与 IDE 重叠的 `pnpm test` 已主动中断，退出码 130；该次运行不计通过，后续全量测试独立串行执行。

零售模板最新正式 IDE 局部任务通过：29 路由 / 36 checkpoints，运行时错误 0；run `bb8db787-6a65-4995-8549-9e6d46c8acfa`，invocation `e22ce3af-4dcb-4900-91fd-62251f848d50`，索引 `.tmp/retail-all-fixed-strict-ide.log`。订单检查独立定义的首屏 5 笔与加载后 7 笔订单和对应金额；售后先验类型选择，再点击退款并验表单。全范围计划仍有 87 个任务未在该次运行执行，严格局部总入口按设计退出 1、标为 incomplete；不能将该任务通过记为全量验收。

随后独立运行的 `pnpm test` 为 1272 files / 12091 tests 通过、2 files / 3 tests 失败，另有原有 12 files / 19 tests 跳过；索引 `.tmp/pnpm-test-full-serial-current.log`。失败分别为生命周期 fixture 缺少 WXML 和 GitHub suite 固定清单遗漏组件 API。补齐后生命周期 5 项单测通过，suite 清单、reporter 和订单分页共 49 项工具回归通过（`.tmp/acceptance-three-regressions-current.log`）。再次独立全量运行通过：1275 files / 12096 tests，保留原有 12 files / 19 tests 跳过，退出码 0，耗时 284.20 秒；索引 `.tmp/pnpm-test-full-current-rerun.log`。

门户导航已用同一真实按钮、同一路由完成对照：`.tmp/dynamic-navigation-settled.json` 在目标 DOM 出现后等待原生成功回调再返回，退出码 0；`.tmp/dynamic-navigation-immediate.json` 在目标 DOM 出现后立即 `reLaunch`，复现 `navigateTo:fail timeout`，退出码 1。前一组 DOM 完成比原生回调约早 393ms，说明可见目标页面不足以证明上一次导航已完成。正式测试已改为等待该次导航 Promise，再执行后续返回操作。

门户正式修复已通过两侧严格验收：IDE run `5fe89465-efa8-4b6d-a84e-c2a685ca5f07` / invocation `599a5a2e-f966-4be3-b887-a59d255e3072`，headless run `9c77b0ac-b811-4010-bdc9-ab2962a06558` / invocation `ae0d3b40-a580-4ea6-abe3-ec2f58b1cd94`，均为 1 case / 7 checkpoints、无运行时错误。测试使用 `routeOnly: true` 调用仍在页面栈中的原首页，等待点击发起的导航 Promise；默认 Page 协议不能调用非栈顶页面。对应 simulator 栈顶限制、页面身份、卸载后不误调用替代页的 43 项单测，以及 browser 和实际 tsd 文件均通过（`.tmp/simulator-page-method-browser.log`、`.tmp/simulator-page-method-tsd.log`）。同一 IDE run 的 Retail 仍因金额组合 XPath 失败，整轮仅 1/2 tasks 通过，不能整体记为通过。

原生 lazy 的完整生产构建对照 `.tmp/native-lazy-production-build` 通过首屏 DOM，所有原始页面输出完整，未启动 dev/HMR。成功组同样有 IDE 双重 reload，排除了“双重 reload 本身必然失败”的推断。完整 classic dev 对照 `.tmp/native-lazy-dev-classic-hmr` 也通过，保留 development 条件导出与 lazy，差异进一步缩至 stateful。

通过 Vite/Rolldown 正常 banner/footer 添加 chunk 轨迹后，classic 对照 `.tmp/native-lazy-classic-startup-trace` 完成 DOM 并收到 14 个进入/退出事件；stateful 对照 `.tmp/native-lazy-stateful-startup-trace` 在 `App.CDPEnable` 超时，collector 没有事件，随后只读 App-service 探针亦超时。空的异步网络轨迹不能单独证明应用首行未执行；宿主主包同步装载和可能未刷出的执行事件仍需定位。两组只用于诊断，不能替代正式 HMR 验收。

后续将孤立加载入口临时从 app 移至第二页面的源码对照通过产物 audit，但真实 IDE 仍 CDP 超时，证据 `.tmp/native-lazy-second-page-loader-owner`。该实验已撤回，原文比对一致，CLI 已正常重建。此结果只用于缩小诊断范围，未作为交付修复，也不构成 HMR 通过证据。

随后在 `viteAdapter.ts` 进行 whole-output compact/minify 临时诊断，构建阶段因缺少三项 runtime 契约被拒绝，未进入真实 IDE。源码已按 `.tmp/native-compact-source/restore.patch` 精确恢复并与原文比对一致，正常 CLI 重建退出 0，日志 `.tmp/native-compact-restored-build.log`。之后 vendor-only renderChunk 对照通过模块图与 runtime audit，vendor 从 664221 减至 450728 字节（减少 32.14%），真实 IDE 仍 `App.CDPEnable` 超时，未达 DOM；证据 `.tmp/native-lazy-vendor-render-compact-ide`。该对照未修改真实源码，输出变小不能作为修复或验收通过。

后续从已安装 IDE 只读提取实际 Babel 依赖并精确重放该 vendor：转换 29.146 秒、总进程 29.474 秒退出 0，CPU profile 的 92.6% 位于 function-name → scope rename 路径，支持冷编译超过早期约 10 秒日志协议预算的根因方向。诊断见 `.tmp/nativeBabelReplay/root-cause.md`；计时来自独立 Node 子进程，不等于 IDE 内实际计时，也不单独证明原始页面或 HMR 已通过。启动订阅 deadline 修复在上述 18-task 全量结束时尚未应用，随后已正式应用并完成以下原场景验收。

### 原生 lazy/stateful 启动订阅修复已验收

正式修复收敛于 `e2e/utils/runtimeLogSubscription.ts` 与 automator 启动编排：同一已连接会话仅对明确的日志订阅响应超时串行重试，保持原启动 attempt 的总截止时间；编译错误、协议不支持、断连及业务异常仍立即失败。取消后不再发起订阅请求，外层超时仅在对应阶段转换为 deadline 错误。工具回归 44 tests、launcher 回归 62 tests 和 ESLint 均退出 0。

正式 `template-tailwindcss-tdesign-hmr.runtime.test.ts` 使用原始项目配置，保留增强编译、lazy、stateful 与第二页面。同一连接在日志订阅阶段两次约 10 秒响应超时后成功，不重新启动项目。run `ebe142be-4441-468d-b40d-60b4d532fca9`、invocation `9d6551b4-10d6-489b-b612-025b8ef39691` 的严格 DOM 报告为 passed、**1 case / 5 checkpoints**、`errors: []`；IDE `2.02.2608060` / 基础库 `3.17.2`，五份证据全部来自 devtools-page-frame。

验收实际覆盖浅色初始背景、暗色交互、HMR 后暗色状态保留、切回浅色显示新背景、再次暗色切换。各阶段真实计算样式和可见布局符合独立期望，HMR 后页面 ID、page marker 与 App marker 保持，原交互状态保留。主日志 `.tmp/native-tdesign-hmr-subscription-fixed.log`；完整证据 `docs/reports/dom-acceptance/ebe142be-4441-468d-b40d-60b4d532fca9/9d6551b4-10d6-489b-b612-025b8ef39691.json`。

这证明原生启动阻塞已在原配置下修复，不是关闭增强编译或换为 classic。该 run 仍是严格局部运行：总入口因其余 87 个 tasks 未执行而退出 1，本任务 passed，整体 incomplete。报告依旧对应 dirty HEAD `2dc0bce4b`；此前 18-task 完整运行早于订阅修复，最终提交仍需无筛选 exhaustive 及相应全量复验。以上历史失败、临时实验与 UUID 全部保留。

`ide-dom-headless` 的 20 个任务包含历史 16 个已验证入口，以及本轮结算、组件实例 API、门户动态绑定和 App 冷启动参数转发；对应场景均在 exhaustive IDE 清单内。上表 19 任务全量记录早于最后一项接入，最新 20 任务完整结果见下文。headless 与 simulator browser jobs 在 PR 使用三 OS 的 Node 22，手动完整 workflow 使用三 OS 的 Node 22/24。Acceptance Contracts 检查 shared-launch、静态 inventory，以及 `e2e/scripts/**/*.test.ts` 和 `e2e/utils/**/*.test.ts`；CI full 自动发现其余 `e2e/ci` 回归。

生命周期修复前的 19 任务 headless 运行 `cbe769b4-284b-4f2a-a556-c6b537b7135d` 全部执行，18/19 通过，唯一失败是 Wevu behavior 的 attrs、provide/inject 和深层注入作用域三个 case；该任务 6/9 cases、16/24 checkpoints 完成，整体退出 1，日志 `.tmp/ide-dom-headless-full19-current.log`。对应真实 IDE 正式运行 9/9 cases、24/24 checkpoints 通过，原断言完整保留。

原生探针在 IDE `2.02.2608060` / 基础库 `3.17.2` 记录顺序：`child:created → page:created → page:attached → child:attached:page-provide-value → page:onLoad → page:onShow → child:ready → page:ready`。实际文本显示 `page-provide-value`，完整 WXML 与截图分别保存在 `.tmp/component-page-lifecycle-probe/index.json` 和 `.tmp/component-page-lifecycle-probe/screen.png`。simulator 将组件页面的 attached 时机对齐该顺序，保留原生子组件 created 与 ready 边界，修复初始 attrs 和注入作用域读取错误；共享 helper、Node/browser 回归及 `.changeset/simulator-component-page-attachment.md` 已沉淀。

修复后 188 项单测、typecheck、lint 通过，重建日志 `.tmp/simulator-component-page-build.log`；完整 browser 30 files / 66 tests、严格 headless 19 tasks / 39 cases / 147 checkpoints 均退出 0。完整 headless suite 索引为 `docs/reports/2026-09-08-033252-e2e-ide-dom-headless-7afee9f4-suite-report/index.json`，run `1124010a-49a3-486c-abab-80fa3f765214`，十九份报告均 passed、无错误，未跳过或遗漏。以下 invocation 均归属该 run：

| 任务（相对 `e2e/ide/`）                                      | invocation                             |
| ------------------------------------------------------------ | -------------------------------------- |
| `github-issues.runtime.component-instance-apis.test.ts`      | `b6b9b05a-a2d0-459b-8ca4-ef1edc576a40` |
| `template-retail-checkout.runtime.test.ts`                   | `776f76cf-7c21-4511-9a20-ee58867f60d4` |
| `app-prelude-native.runtime.test.ts`                         | `ef86c5cb-4029-49a4-bd92-12071986986f` |
| `auto-routes-define-app-json.runtime.test.ts`                | `c356eb51-428d-4ec8-9857-b97d84f6564f` |
| `react-runtime-spike.runtime.test.ts`                        | `557b6208-fbac-424b-ad31-ccbe536827dc` |
| `wevu-features.runtime.behavior.test.ts`                     | `33658947-da8b-4747-9e16-d5924aaf9e7c` |
| `wevu-features.runtime.router.test.ts`                       | `352f30ee-042d-4376-a198-632292adb67e` |
| `template-weapp-vite-template.test.ts`                       | `b37f0354-51f1-44d5-b576-7ac6076502f7` |
| `template-weapp-vite-wevu-template.test.ts`                  | `948b75bb-1e31-4b3b-94ba-137c31c2c035` |
| `template-weapp-vite-multi-platform-template.test.ts`        | `037b676e-20c5-4e68-9a22-e738f8b4baa2` |
| `template-weapp-vite-multi-platform-sfc-template.test.ts`    | `5b613a68-f140-4d3f-ab6f-2b60a327c057` |
| `template-weapp-vite-wevu-template.layouts.runtime.test.ts`  | `3f1292a8-fb9a-4733-bc37-d1283154b31f` |
| `chunk-modes.runtime.duplicate.test.ts`                      | `7e81946b-c0b8-435a-b1d0-daa8b1cfa795` |
| `template-weapp-vite-wevu-template.dynamic-bindings.test.ts` | `85ebd76c-00b8-442e-8454-ccbe80f893bb` |
| `chunk-modes.runtime.hoist.test.ts`                          | `dccb040b-dfaf-45af-8cba-a913add0315e` |
| `chunk-modes.runtime.extras.test.ts`                         | `d5f9fd66-14b9-49b7-ac52-ac039676c3db` |
| `subpackage-shared-strategy-complex.runtime.test.ts`         | `2aac2ee1-8d13-4efa-8d86-cb9fe099c06d` |
| `tdesign-dialog-import.runtime.test.ts`                      | `e46a05b1-9497-4b24-a0b4-1ce8bc52c26a` |
| `wevu-vue-demo.script-setup.emit.runtime.test.ts`            | `5fe5c4e2-99a4-4339-995b-5511f2ae4d0e` |

最终需在同一提交上完成 `pnpm test`、`pnpm e2e:ci`、`pnpm e2e:ide:full` 和 `pnpm e2e:ide:full:exhaustive`。推送后保留 PR-only 构建、类型、Platform Gate、changed HMR、Runtime Size 等检查，同时触发完整 CI、CI E2E、Policy、Performance、Tutorial 与适用的 VSCode workflow，核对矩阵、分片和报告内容。模板 performance 已增加报告完整性门禁：构建/HMR 失败或缺项在保存报告后返回非零，workflow 始终上传报告并独立校验完整性；33 项回归通过，实际云端运行尚待验证。不自动合并或发布。

## 已沉淀的宿主语义与修复边界

| 观察面           | 固定契约与覆盖                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #955 属性和文本  | 真实 IDE 中显式 `null` 保留；动态属性绑定的 `undefined` 传递为 `null`，省略属性才应用默认值。`type: null` 不套缺省值；文本插值 null 显示为 `null`。首屏摘要保持 `string:SALE\|null`，后续变更不改写初始快照。                                    |
| 原生组件生命周期 | created 先读默认值，随后原子写入全部输入，执行 data observer、声明顺序的 property observer，最后进入 attached。Node/browser fixture 对齐；#558、#615、#930 与 portal 后续 headless 局部复验消除了旧差异。                                        |
| 原生插槽查询     | CSS 查询依照声明者作用域，不能用物理 DOM 层级推断接收 slot 的宿主可查询投影内容。原生默认插槽、泛型投影、命名/scoped 插槽分别保留作用域回归。                                                                                                    |
| Guard 与首屏     | blocking guard 延迟 setup/mounted，不阻止初始静态 WXML 显示。abort/reject 阶段检查真实标题与 pending，结果页仍验 mounted 数量和完整轨迹。                                                                                                        |
| `rpx` 计算       | 实测 390 CSS px 窗口下：`8rpx = 4px`，`192rpx = 99px`，`calc(8rpx * 24) = 96px`；字体 `40rpx = 20px`，`56rpx = 29px`，无单位 1.4 的行高为 28px。`rpxCalc` 先换算原子再乘倍数，不能提前折叠总量或放宽容差。证据 `.tmp/rpx-ide-measurements.log`。 |
| 嵌套 CSS 变量    | 微信探针观测嵌套回退、动态覆盖与恢复；保留级联依赖。headless 检查节点/class，浏览器和 IDE 才检查实际样式。旧诊断 probe 有两条未分类错误，不能用其两个测试返回通过替代严格正式验收。                                                              |
| Tailwind 输出    | 重发资产的对象身份不能充当内容去重；pending 标记必须保留到最终 CSS 注入。外部 SFC style src 按真实文件身份确认归属，不比较编译前后全文。定向 owner/HMR 回归通过，最终全量仍待完成。                                                              |
| 零售迁移         | 保留 nullable 列表契约、真实事件 payload 和条件分支求值；嵌套 key 投影不能混用原始/投影数据。结算输入补商品标题、金额和数量，异常不得被 catch 后的 navigateBack 二次错误掩盖。                                                                   |
| HMR 孤立模块     | JSX 重导出优化会留下未执行 facade，后续 patch 仍需按原始模块 ID 初始化。加载器保留新工厂优先、循环检测与旧 chunk 覆盖保护；由 app 持有静态依赖，核心 runtime 不反向引用 facade，产物仍由 Vite 写入。                                             |
| 日志和恢复       | 启用 Runtime 域后订阅 console；只对明确不支持协议的旧宿主兼容，超时不得降级。启动/refresh/compile 错误保留至关闭；超长错误受 UTF-8/JSON 预算限制，不能使恢复请求超限。日志边界修改后已重建并通过实际类型与局部 IDE 验证，仍需最终全量验收。      |

`rpxCalc` 当前仅约定换算后至少一像素的正原子及正倍数，不外推最小像素、负值或其他 renderer。`wx.rpx2px` 和 Web 连续比例转换也不能替代 WXSS 计算样式。

### 网络与环境问题

真实 HTTP/socket 与 headless response mock 是不同验收面。历史请求组 headless 有 11 个失败；请求模拟与 WebSocket transcript 单测只证明已模拟回调、帧次序及渲染，不能替代 fetch/axios/graphql-request/vue-query、Socket.IO、服务端随机消息的真实往返。保留原 IDE 断言，不给真实网络套件注入 mock 后记为通过。

`MaxSubPackageLimit` 启动错误来自 CLI 提前创建不完整项目记录。修复仅更新 IDE 已完整导入的信任记录，不补写私有 attr。已有坏记录用正常 IDE「详情 → 项目配置」刷新能力再编译，记录额度、路由、截图和错误；页面恢复不代表正式 case 通过。恢复截图：`docs/reports/dom-acceptance/ide-cache-recovery/layout-after-project-config-refresh.png`。

插件本地开发使用版本 `dev`。IDE 二次 Babel 转译的插件越界 helper 路径记录为 [issue #963](https://github.com/weapp-vite/weapp-vite/issues/963)，兼容配置仅在 IDE `2.02.2608060` / 基础库 `3.17.2` 验证，不表示宿主缺陷已修复。插件页面路径和 AppService 页面栈是不同观察面；CSS 查询失败时使用已证明可用的原生页面帧 XPath，并保留文本与数量断言。

## 历史运行与证据索引

下表保留诊断链，已被后续修改影响的通过项仍标为历史。JSON 默认位于 `docs/reports/dom-acceptance/<run>/<invocation>.json`；只有 run 时查看该目录内对应任务报告。同一混合运行内某 case 通过，不改变该运行整体失败状态。

| 分组                     | 历史证据索引                                                                                                                                                      | 结论与后续状态                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Headless 初始接入        | `73a9dab2-76fe-488e-88d2-3c85bd429059`                                                                                                                            | 9 tasks / 26 cases。                                                                                                              |
| Headless 布局/chunk/分包 | `faae4885-4035-45ea-aeb6-c9653b682f9f` / `c356ee1b-8714-40bd-827f-3985ac738ab9`                                                                                   | 5 tasks / 7 cases。                                                                                                               |
| Headless 弹窗/emit       | `6c674ce1-4221-4b49-90f2-cd9b2b80066a` / `70adf223-c04d-4cf0-ae3a-fa60f3996616`                                                                                   | 2 tasks / 3 cases。                                                                                                               |
| Headless 完整历史基线    | `7ff712c9-6cd0-4d39-8e20-2f922493f4a3`、`c2b195b0-ab93-40c4-99c4-f060bdadfa0c`                                                                                    | 每轮 16 tasks / 36 cases / 132 checkpoints；旧文 142 是统计笔误。                                                                 |
| Headless 请求诊断        | `a215e2b1-4827-4ee8-9de3-c71abc6dfef0` / `d8feb56f-8471-4286-8465-da0c9a39154f`                                                                                   | 5/16 cases 通过、11 失败；真实网络未验收。                                                                                        |
| IDE 请求                 | `a866b71d-7d92-448f-92ef-681a09abb23e` → `3d0ee255-cd1f-4e09-be79-0aec085ed956`                                                                                   | 前次原生 Socket.IO 路由异常；后次 13 cases / 29 checkpoints 通过。首次瞬时问题根因未确认。                                        |
| 普通 IDE 初次运行        | `1c0c3955-31ec-4bc3-ab1f-2f6e6904ba65`                                                                                                                            | 第 3/18 task 因 PTY 初始化失败停止。                                                                                              |
| CLI 快捷键复验           | `fb9110c2-e21f-4ea0-b135-00009c4524dc` / `114bcdad-fdbf-49a7-b220-ed5ca6c2ebd1`                                                                                   | 2 cases / 5 checkpoints 通过；筛选运行仍为局部。失败截图 `cli-hotkey-diagnostics/after-fullpage-timeout.png`。                    |
| Tailwind/JSX 早期 HMR    | `3d541a7f-645c-4008-80a9-3c717bb3897f` / `ce9fd28a-2f7e-486a-8c49-a07ba044e8bd`                                                                                   | 2/3 cases 通过，JSX 路由错误；不是分组通过。                                                                                      |
| JSX HMR 复验             | `2b142d1a-cb92-49dd-9439-c6de5ad248cb` / `cce929dd-8c23-4872-b110-f47ecccd0d9b`                                                                                   | 1 case / 5 checkpoints，计数 0→1→3、身份保留；后续 loader 边界变化仍需重验。                                                      |
| Core/vendor HMR 早期失败 | `8ae667fa-7e1a-4c92-885d-daee9e9ec5ae` / `fe081526-1b4b-4a2a-ba78-db898d96e33c`                                                                                   | 2 cases 均失败；方法、DOM、storage 和页面身份需并列诊断。                                                                         |
| Core/layout 局部复验     | `7d051c26-c16a-42ed-9f6c-966702394612` / `c0013ee6-468d-4329-a0ef-bc2ff219bf08`；`331f6f85-c227-4a52-b283-b307bece0525` / `c324a6b3-7010-49ee-adc6-705cc919673e`  | 对应 HMR case 通过，混合运行仍有其他失败。                                                                                        |
| 已提交普通 IDE 完整运行  | `ad311335-e42b-4c9a-a4e8-80332b72d1e7`                                                                                                                            | dirty=false；前三任务通过，聚合 61/64 cases 后失败，14 tasks 未执行。#466 操作异步、#300 解构语义、#955 查询作用域后续分别修正。  |
| IDE 断点运行             | `2cf2a659-8236-408a-802e-fd32f1ef2f74`                                                                                                                            | 选择 8 tasks，3 通过，插件启动失败后停止，4 未执行。                                                                              |
| 插件白屏/恢复截图        | `abb86f51-8422-458d-9ea1-6ca772217d3c/36193cbd-bbd8-4258-a8e3-fd9d38b62d5d.png` → `a972f526-66e9-4054-90c3-ad62cdfd0098/acb108b8-bffb-4d71-b5c9-2aa4ad68af26.png` | 插件二次转译兼容诊断；不能替代正式验收。                                                                                          |
| 模板入口                 | `a2032f97-4bc5-431f-8508-1aeff6a44269`                                                                                                                            | 11 个模板完成 DOM，参数化标题截短使严格报告失败；改用完整标题和 `it.for` 上下文。                                                 |
| Wevu 后两组              | `7b0c47ba-9e1b-4611-a6f0-61dc406a3e49`                                                                                                                            | 15 cases 局部通过；其他重叠诊断运行已终止作废。                                                                                   |
| 插件示例                 | `068a8c2b-4d2f-4455-9733-9b63e83c8e14`                                                                                                                            | 3 checkpoints 局部通过，含插件页 XPath。                                                                                          |
| 无筛选继续收集失败       | `1ce7be6c-bb15-4ace-b36f-12eb6eb9177f`                                                                                                                            | 微信 65/86 tasks 通过、21 失败、3 范围外；退出码 1，不能作为最终验收。guard 失败截图 `c8896aab-8a16-40f1-9a61-f2f6636bf11a.png`。 |
| Guard 与混合分组         | `073d4021-c5aa-4a38-8e78-559ef2385377` / `bdc42c41-ec52-4a8d-8632-2fec139a40e1`                                                                                   | #911 的 7 cases / 19 checkpoints 两 provider 局部通过；混合十项只有四项通过，其他启动错误保留失败。                               |
| 独立分包 portal          | `8bbadef9-59d0-46cc-993a-64fed7f4831d`                                                                                                                            | 7 checkpoints 完成，但启动空错误使严格报告失败。                                                                                  |
| Wevu TDesign style src   | `05aefac3-7621-40e8-8ebf-27de97f9a104`                                                                                                                            | 2 checkpoints 通过并同步快照；后续最终运行不得使用更新快照模式。                                                                  |
| 原生模板选择器           | `90dbf15c-bd64-471f-89b1-1d6c56c2fad5`                                                                                                                            | TDesign/Vant 通过；普通 Tailwind 状态选择器误命中说明卡片，后续按 hero 作用域修正。                                               |
| 模板与结算               | `a0c7599f-9c4b-420a-93ed-4e69de79c44c`                                                                                                                            | 普通 Tailwind/Wevu TDesign 无快照更新通过；结算金额 DOM 已出现但旧 XPath 失败，后续改用实际 `.pay-amount` 作用域。                |
| 结算旧 headless          | `13025786-2beb-4177-a986-7958811f8bb4`                                                                                                                            | 4 checkpoints 完成但缺 getRelationNodes/createSelectorQuery，严格失败；新通过证据见当前表。                                       |

### 历史命令日志

最新无筛选 CI 运行见 `.tmp/pnpm-e2e-ci-full-current.log` 与 `docs/reports/2026-09-08-035047-e2e-ci-e6adb7f1-suite-report/index.md`：75/75 tasks 通过、退出码 0；HMR guard 26/26，auto-import-vue-sfc、auto-routes-hmr、shared-chunks-auto 各 3/3。工作树 dirty，最终 SHA 尚待确认；下表继续保留早期诊断链。

生命周期修复后无筛选单测 `.tmp/pnpm-test-full-component-page.log` 为 1277 files / 12106 tests 通过，原有 12 files / 19 tests 跳过，退出码 0，耗时 279.07 秒。它更新了前次 1275/12096 的阶段证据，旧日志继续保留，不将两次统计相加。

| 索引                                                                                                                               | 覆盖与限制                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-09-07-164003-e2e-ci-8837ec26-suite-report`                                                                                   | 无筛选 CI 75/75 tasks 历史通过，包含 26 项完整 HMR guard 及专项；后续源码修改使其不能作为最终证据。                                          |
| `.tmp/e2e-ci-current-complete-snapshot.log`                                                                                        | CI 74/75，HMR guard 24/26；发现其他工作区 E2E 残留，不能用作最终串行验收。                                                                   |
| `.tmp/tailwind-hmr-owner-recheck.log`                                                                                              | 原六个 CSS HMR/内存失败 case 定向通过，未放宽阈值。                                                                                          |
| `.tmp/pnpm-test-slot-guard.log`                                                                                                    | 历史完整 unit 1261 文件 / 11987 tests，早于 rpx 与后续改动。                                                                                 |
| `.tmp/pnpm-test-checkout-variance-current.log`                                                                                     | 历史完整 unit 1266 文件 / 12021 tests 通过；早于后续宿主 API、HMR 和日志修改，最新完整运行失败见当前表。                                     |
| `.tmp/simulator-three-browser-recheck.log`                                                                                         | 组件实例 API、结算、嵌套 CSS 变量 3 files / 3 tests 局部通过。                                                                               |
| `.tmp/simulator-component-api-tsd.log`、`.tmp/automator-structured-tsd.log`                                                        | 对应修改阶段在新 dist 上显式运行实际 tsd 文件通过；后续最终构建与类型复验见当前表。                                                          |
| `.tmp/simulator-browser-full-current.log`                                                                                          | 最新 browser 全量 29 files / 65 tests 通过、退出码 0；该日志已更新，不再指向此前 24 files / 60 tests 的历史内容。后续 simulator 修复需重验。 |
| `.tmp/ide-template-reviewed-snapshots.log`                                                                                         | Wevu TDesign 和 features 局部通过；原生模板当时在 rpx 期望失败。                                                                             |
| `.tmp/hmr-audit-lifecycle-final/report.json`、`.tmp/hmr-audit-wevu-final/report.json`、`.tmp/hmr-audit-template-final/report.json` | 三个旧 CI 失败项目的独立产物 HMR 审计，完整云端 workspace audit 仍待最终提交执行。                                                           |

## 首次冷启动参数验收

候选提交 `c6c06bdbe` 的无筛选 exhaustive 运行 `bad9ef3e-42ec-4f33-a374-5af35c2a7264` 在 `app-lifecycle` 首项失败：6 个 DOM 检查点已采集，但原生 App 收到 `path: "" / scene: -1`，另一次 Wevu 冷启动收到 `path: "pages/index/index" / scene: 1001`，跨进程参数比较失败。其余 87 个微信任务未执行，3 个百度任务范围外，不能视为完整通过。证据索引为 `2026-09-08-045107-e2e-ide-full-exhaustive-5aa85de9-suite-report` 与 `.tmp/exhaustive-c6c06bdbe.log`。

参数转发应验证同一次宿主调用：在原生 `App` 注册边界、进入 Wevu wrapper 之前同步保存原始参数，与该 fixture 的 hooks 日志完整比较；跨 fixture 比较生命周期顺序及状态。不能删除 `path`、`scene`，不能通过重编译、重启或重放 hook 丢弃首次输入。启动条件未初始化的宿主输入必须保留在证据中，不能改写成默认首页。后续修复仍需真实 IDE 和对应 headless 验收。

边界断言修复后的真实 IDE 局部运行 `1933e865-9392-4ff7-b5ff-15b01882e48a` / invocation `0d0f316c-f692-49d9-b4ba-09035f6f9811` 为 1 case、6 DOM 检查点通过，三种 fixture 均只有一次 `onLaunch`；完整原始参数、对象身份与页面显示均通过，未使用启动恢复。日志 `.tmp/app-lifecycle-boundary-devtools.log`，suite 索引 `2026-09-08-051442-e2e-ide-regressions-a83f39ba-suite-report`。该定向 runner 因其余任务未执行而退出非零，不能记为 exhaustive 通过。同一 case 的 headless 局部运行 `.tmp/app-lifecycle-boundary-headless.log` 通过；observer 和 manifest 的 33 项回归通过，覆盖参数丢失、突变、等值克隆、回调身份、getter 副作用及注销参数保真。

真实 IDE 的正常首次启动以首页路径和空 `referrerInfo` 调用 App。对应修复使 headless testing launcher 在解析首页后才启动 App，并让 Node/browser 共用启动参数复制逻辑，保留显式 scene 和来源字段；公开类型允许空或部分 referrerInfo。17 项定向单测、2 项 browser DOM、包级 typecheck 和显式 tsd 均通过。复用原生场景的 20 任务严格 headless 全量 `6bac3856-634e-469b-b32c-12cd0a16a7db` 为 40 cases / 153 checkpoints 全部通过、退出码 0，20 份报告无失败、阻塞、跳过、未执行或报告错误。日志 `.tmp/ide-dom-headless-full20-launch-options.log`，suite 索引 `2026-09-08-052710-e2e-ide-dom-headless-4a51ba2e-suite-report`，其中生命周期 invocation 为 `5512f01c-0dea-4c86-9f74-1dae4f07fca6`。这是提交前工作树结果，后续最终命令和真实 IDE 全量仍需绑定交付提交。

上述 20 份 case 报告均为 `strict: true`，但进一步审计发现历史 suite 顶层为 `strict: false`，未强制验证任务报告缺失。已将 `ide-dom-headless` 纳入默认严格 suite，总门禁与逐 case 检查同时生效；即使子命令退出零、传入允许失败或将环境严格开关设为零，缺失验收报告仍失败。54 项相关回归通过，最终提交仍需完整重跑此 gate，不以历史 suite 顶层结果代替。

## Component 页面样式 HMR 对照验收

产品 HMR 使用显式 `bridgeProjectMode: 'direct'`，由真实 IDE 直接观察 Vite 输出；镜像工具专项保留 `snapshot`。镜像同时引入文件同步及项目配置合并，因此不能只凭镜像与直连结果不同，把复制延迟认定为唯一根因。

候选修复为已确认的 `apply-shared` Component 页面生成自包含全局 WXSS，保留最终 JSON 覆盖、独立分包边界和局部样式优先级。正式场景连续两次直连均完成 7/7 检查点；使用显式模式 API 后，产品场景和镜像专项共同完成 2 cases / 13 checkpoints，严格报告 `3895b4bd-e994-4520-bbdd-987c45251853` / `bcb70d86-71f5-4649-98d3-8a08d67c56f8` 通过。

单变量对照临时关闭页面全局样式快照，仅移除新增产物的启动等待，保留全部 7 个 DOM 检查与 HMR client、页面/App 身份及计数断言。真实 IDE 删除背景类时重新创建了页面和 App，严格报告 `887b0fd7-cb02-4aec-8513-1ecc8fad6244` / `3ad67348-e814-4ddc-93e5-ff71e31449c8` 失败，停在 3/7 检查点。诊断改动已逐字恢复并重建，不进入提交。这些证据均来自未提交工作树，最终验收仍须对应交付 SHA。

对应 simulator 覆盖真实 DevicePreview 的样式导入、页面内联快照、连续更新、局部优先级和交互状态；最终页面 JSON 的隔离选项覆盖 JS 注册值，普通 Page 不套用 Component 页面规则。compiler 静态元数据对对象展开 getter 的副作用保持保守，并以实际执行结果建立回归。

## 维护与最终确认命令

```sh
node --import tsx e2e/scripts/domAcceptanceReport/inventory.ts --write
node --import tsx e2e/scripts/domAcceptanceReport/inventory.ts --check
node --import tsx scripts/check-e2e-ide-shared-launch.ts
pnpm exec vitest run -c e2e/vitest.e2e.internal.config.ts
```

`--check` 同时检查清单新鲜度与完整性，不能通过重新生成缺计划的清单绕过检查。内部工具回归覆盖缺证据、错路由、过期证据、查询异常、聚合遗漏、skip、提前终止、局部运行、错误消费和路径脱敏。

公开类型必须执行真实 test-d 文件。当前 tsd 默认推导可能把 `.d.mts` 声明本身当作测试，不能以默认命令返回零证明契约通过。已同步 dist 后使用 `pnpm --filter <package> exec tsd --files "test-d/**/*.test-d.ts"`；含 TSX 的包按其脚本显式包含 TSX。正式交付保留构建、类型、runtime 和最终提交证据的对应关系。
