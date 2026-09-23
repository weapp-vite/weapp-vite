# 微信、支付宝、抖音全面回归

## 范围与准备

从最新主线建立隔离 worktree，记录基线提交、最终提交、Node/pnpm 与三端 IDE 版本。先安装锁定依赖，再完成 `pnpm build:pkgs`。

专项排除通过 `WEAPP_VITE_E2E_EXCLUDE_PROJECTS=uview-plus-compat,wot-ui-compat` 指定。值为逗号分隔的项目目录名，不接受路径或通配符；未设置时保持原有范围。变量由子进程继承，同时作用于 suite 任务、直接 Vitest 入口和 Web 项目发现。通用编译器、平台构建和运行时测试不因引用这些库而被排除。suite 报告记录排除列表，独立任务标记为 `out-of-scope`。

所有 E2E 入口互斥运行，包含 simulator browser、headless、Web、官方编译与人工 IDE 复验。执行前检查残留进程，长时间运行启用系统防休眠。`test:types` 会触发包构建，不要与单测或下游构建并行；类型验证后重建包，再执行下游验证。

## 自动化入口

以下各项依次执行，发现失败后先最小复现、修复、重建，再继续。诊断可使用 `--allow-failures`，最终验收必须严格执行。

| 层级 | 命令 |
| --- | --- |
| 类型契约 | `pnpm test:types` |
| 构建同步 | `pnpm build:pkgs` |
| 单测、规范 | `pnpm test`、`pnpm lint`，以及各 owning package 的 `typecheck` |
| 应用与模板 | `pnpm build:apps`（包含模板） |
| CI 与 HMR | `pnpm e2e:ci`，启用 `E2E_FULL_MATRIX=1` |
| 多平台产物 | `pnpm e2e:platform:build`，启用 `E2E_FULL_MATRIX=1` |
| Web | `pnpm e2e:web:build-projects`、`pnpm e2e:web`、`pnpm e2e:web:browser-smoke` |
| simulator | `pnpm --filter @mpcore/simulator test:e2e` |
| headless | `pnpm e2e:ide:headless:full`、`pnpm exec tsx e2e/scripts/run-e2e-suite.ts ide-dom-headless` |
| 微信 | `pnpm e2e:ide:full:exhaustive`，以及 suite 明确列出的人工复验项 |
| 支付宝官方编译 | `pnpm e2e:platform:runtime:alipay`、`pnpm e2e:platform:ide-build:alipay:template`、`pnpm e2e:platform:ide-build:alipay:sfc-template` |
| 抖音准备 | `pnpm e2e:platform:doctor:tt`、`pnpm e2e:platform:open:tt` |

`e2e:ci:full` 只执行排除 HMR guard 后的 CI 文件集合，不能单独替代上表的 `e2e:ci`。若分阶段执行，依次运行 `e2e:ci:full`、`e2e:hmr:guard`、`e2e:hmr:guard:auto-import-vue-sfc`、`e2e:hmr:guard:auto-routes-hmr` 和 `e2e:hmr:guard:shared-chunks-auto`。完整验收设置 `WEAPP_VITE_E2E_FORCE_HMR_GUARD=1`，让文件系统型 HMR 用例实际执行；探针跳过不能记作通过。

全仓 lint 不读取专项 E2E 排除变量，应额外传入 `--filter=!e2e-app-uview-plus-compat --filter=!e2e-app-wot-ui-compat`。fresh worktree 的安装阶段可能因尚无 CLI `dist` 而跳过 `prepare`；先完成包构建，再通过下游构建生成受管支持文件。需要验证实际构建而非缓存恢复时，使用 `pnpm build:pkgs --force`。

综合构建命令如果额外包含被排除的独立 workspace 项目，使用对应包名的 pnpm/Turbo 过滤参数。保留其他公开平台原有构建回归，但本流程只要求微信、支付宝、抖音真实 IDE 运行验收。

严格 suite 的 `--filter`、`--from` 只用于定位或续跑诊断：即使选中的任务全部通过，报告仍标记覆盖不完整，并以非零状态退出。不要将这种退出状态误判成新的测试失败，也不能把分段结果拼成最终全量通过。最终执行不带筛选参数的完整入口；需要优先复验某个任务时，可用 `--roll-from=<任务名>` 调整全量执行顺序。首次失败与未修改源码的复验结果分别保留，重跑通过本身不能证明根因已修复。

## 真实 IDE 复验

微信使用 provider-compatible suite，共享 automator 会话，通过 `reLaunch` 切页；新增场景同步 fixture 页面条件、真实 AppID 和产物存在性断言。支付宝与抖音使用官方 IDE，缺少稳定自动化协议时通过 Computer Use 逐步操作并记录前后状态。

| 项目 | 必验行为 |
| --- | --- |
| 支付宝 demo | 原生首页、计数组件事件、SJS 文本、antd-mini 按钮、原生分包往返、Vue/wevu 状态及组件事件 |
| 抖音 demo | 原生首页、计数组件、WXS 文本、本地 npm 原生组件事件、原生分包往返、Vue/wevu 状态及组件事件 |
| 两个多端模板 | 分别在支付宝和抖音验证冷启动、平台标记、计数更新、组件渲染及事件 |
| 开发模式 | 分别修改模板、脚本和样式，检查 IDE 更新后的可见结果，随后恢复测试修改 |

Store 定义更新需区分 action 手动替换与 Pinia HMR。当前 Store 不支持 Pinia HMR；修改定义后应冷启动 App，再验证新默认值、插件记录与跨页共享，不能用页面 `reLaunch` 代替 App 重启。页面、SFC、layout 的状态保持检查仍须在同一会话完成。

共享 automator 在基础设施故障后重启时，调用方必须继续引用当前连接；不能混用新页面与旧会话采集版本、截图或执行后续导航。`github-issues.runtime.issue1049.test.ts` 主动注入一次导航故障，检查恢复后的冷启动状态、版本与 DOM 证据，以及原会话引用的后续导航；同一场景同时运行 devtools/headless，simulator 保留 Node/浏览器对应测试。恢复失败仍须报错，不把旧连接超时改写成通过。

共享模板 HMR 同时检查输出与宿主状态：import/include 更新完成后，内容未变化的页面和组件 JS 不应重新写入；检查仍处于原路由且显示新模板。脚本失效仍须刷新入口，新增组件必须生成脚本，WXS 更新按实际 classic 重载行为验收。`e2e/ci/hmr-shared-template-wxs.test.ts` 在三端核对输出时间，微信对应的共享模板/WXS suite 检查路由和 DOM，避免仅凭产物文本更新就判断 HMR 通过。

每个项目记录 IDE/基础库版本、repo-relative 项目路径、路由、动作、操作前后文本或状态、控制台错误、结果与证据。router 或生命周期修复至少包含冷启动主路径及返回、abort、redirect 等相关边界，不将微信专属 React 能力推断为支付宝或抖音支持。

官方编译通过与真实运行通过分别记录；打开 IDE 本身不算运行验收。登录、端口或模拟器故障先尝试 UI 恢复，仍失败时标记环境阻塞与“未完成最终验收”。

### 支付宝子组件最小复验

`apps/alipay-antd-mini-demo` 首页进入 `pages/wevu/index`，依次执行：

1. 首次显示父计数 0、子组件 `0 / doubled=0 / clicks=0`。
2. 点击“子组件 +1”：父计数 1、子组件 `1 / doubled=2 / clicks=1`，面板变紫。
3. 点击父级 antd-mini “+1”：父计数 2、子组件 `2 / doubled=4 / clicks=1`，面板恢复白色。
4. 点击“切换子组件”隐藏，再点击恢复：父计数保留 2、子组件 `2 / doubled=4 / clicks=0`。
5. 再点击“子组件 +1”：父计数 3、子组件 `3 / doubled=6 / clicks=1`，确认没有重复回调。返回首页后再次进入，所有计数归零。

同时检查多端 SFC 模板的 PlatformCard 显示 `alipay`，而非空白。该场景覆盖 setup 挂载、computed props、回调事件、条件卸载和新实例边界；根因单测见 `packages-runtime/wevu/test/runtime-alipay-component.test.ts`。

### 抖音组件与 scoped 样式复验

原生多端模板冷启动应同时出现 PlatformCard 的 `tt` 标记、`MP_PLATFORM=tt` 和 `status=ready`，点击计数 0→1→2。不能只观察页面计数：组件标签与 `usingComponents` 不一致时，整张卡片可能被静默丢弃。SFC 模板还须验证 doubled 0→2→4。

抖音 demo 的 Vue 页应呈现 scoped 标题颜色、字重和页面间距，计数由偶数切到奇数，npm 组件事件更新反馈。原生分包往返后首页计数与事件反馈应保留。开发模式逐项检查模板、脚本和 style-only 更新；记录宿主实际采用全量重载还是保状态更新。

### 微信 retail 人工补验

使用 `apps/tdesign-miniprogram-starter-retail` 原始产物：商品列表→详情→SKU 弹层→返回；分类切换；购物车数量递增→结算摘要；个人中心→资料→昵称清空/输入→返回；地址列表→新建空表单；优惠券列表→详情→可用商品。检查禁用按钮、返回后的状态和控制台，不提交真实订单或导入用户地址。

这些交互只代表已执行路径，不能替代 retail 全部路由清单。异步 mock 页面须等数据加载后再判定；宿主或第三方组件警告单独记录，不把暂时空态、警告或未执行路径改写为通过。

## 结果与交付

结果区分通过、失败、用户排除、环境阻塞、未执行。修复须保留最小 fixture、根因单测和目标平台运行证据；微信与 headless 差异以真实 IDE 稳定行为为准补齐 mpcore 回归。

PR 只提交有意的源码、测试、复验清单和精简结论，不提交机器路径、登录信息或无关 IDE 改写。行为变更添加中文 changeset；涉及 weapp-vite、wevu 或模板时联动 create-weapp-vite。最终代码严格复验并跟踪全部必需 CI，存在环境阻塞时保留草稿状态。

### 2026-09-22 回归记录

基线为 `origin/main` 的 `6f0fbf2d4f56c54df1dd71bdb7d8a3b1e9cef0ab`。Node `24.18.0`、pnpm `12.5.1`；使用锁文件安装，类型契约验证后强制重建包。用户排除项仅为 `uview-plus-compat`、`wot-ui-compat`，通用平台和运行时覆盖保留。

| 验证 | 结果 |
| --- | --- |
| 安装、包构建 | 通过；`install --frozen-lockfile`，36 个包构建任务 |
| 类型契约、包级 typecheck | 通过；25 / 36 个任务 |
| 单测 | 通过；1148 个文件、10778 个用例；既有跳过 12 个文件、18 个用例单独保留 |
| lint | 通过；40 个任务，显式排除两个专项 workspace |
| 应用、模板、网站构建 | 通过；68 / 26 个任务 |
| CI full | 通过；74 个任务，`E2E_FULL_MATRIX=1` |
| HMR guard | 通过；主 guard 27 个用例，auto-import、auto-routes、shared-chunks 各 3 个用例；强制启用 guard |
| 多平台构建 | 通过；7 个文件、40 个用例 |
| Web | 通过；47 个项目构建，78 个 E2E 用例、2 个浏览器 smoke 用例 |
| simulator browser | 通过；52 个文件、101 个用例 |
| headless full / DOM headless | 通过；43 / 32 个严格任务 |
| 共享 automator 检查 | 通过；136 个文件 |
| 微信真实 IDE | 环境阻塞；完整入口确认 109 个任务，清理启动残留后完成到 62 个有效任务；已复验常规模板、GitHub 回归与 HMR，Tailwind 任意背景用例按已复现宿主缺陷 skip，仍未形成无阻塞的最终 exhaustive |
| 支付宝官方编译 | 通过；demo、原生多端模板、SFC 多端模板均通过官方编译入口 |
| 支付宝真实 IDE | demo 运行通过；两个模板已在项目列表显示 `alipay` 标记，模板页面交互及模板脚本/样式 HMR 未执行 |
| 抖音官方准备与构建 | 通过；doctor 4.5.6、demo 构建和项目打开入口通过 |
| 抖音真实 IDE | demo 运行通过；两个模板已在项目列表显示并完成构建，模板页面交互及模板脚本/样式 HMR 未执行 |

微信开发者工具版本 `2.02.2608070`。首次 exhaustive 在第 39 个任务 `issue-1015-css-hmr` 的 classic `replace-variable` 检查失败：产物已更新，当前路由正确，但目标元素查询为空，未收集到 runtime error。随后未修改源码的独立复验和续跑复验中，classic/stateful 的七个检查点均通过。该异常尚未确定根因，不能标记为已修复；分段复验也不作为完整 exhaustive 通过证据。

最终 exhaustive 入口确认包含 109 个任务；清理一次启动残留后，常规模板 `dev:open` suite 通过，累计完成到 62 个有效任务。`template-tailwindcss-tdesign-hmr.runtime.test.ts` 在独立复验中稳定重现官方宿主兼容性缺陷：WXML、`app.wxss`、`weapp-vite-global.wxss` 和页面 WXSS 均包含更新后的绿色规则，stateful HMR 也报告页面/App 实例保留及 `changed=2`，但官方工具仍将页面计算背景色返回透明。已有诊断文档通过宿主模块对照将根因定位到 `getAppConfig` 负超时导致的当前页 WXSS 编译请求丢失；仓库无法修复官方 IDE 内部实现。本轮在基础库 `3.17.2` 上复现，因此按宿主缺陷约定对 `2.02.2608070` 显式 skip，headless、构建和其他微信页面覆盖继续执行；该 skip 计为“环境阻塞”，不计为产品通过。

支付宝开发者工具为 Mini Program Studio，模拟器基础库 `2.10.15`；抖音开发者工具为 `4.5.6`，模拟器为 iPhone 15 Pro。支付宝 demo 中已人工验证原生计数、wevu SFC、父子事件、computed 值、条件卸载重建、原生分包往返及返回；抖音 demo 中已人工验证 `MP_PLATFORM=tt`、TTML/TTSS、原生计数、本地 npm 组件事件、scoped 标题、Vue 计数和 npm 事件、原生分包往返。控制台可见内容为宿主的 SJS、基础库和调试信息；未见业务异常。

模板任务第一次在 `weapp-vite-wevu-template` 启动时、第二次在 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 启动时均出现 `getPageMetaByWebviewId(...)` 返回空值，导致 automator 等待超时；失败前其他模板已完成运行断言，且 Wevu 模板单独重跑通过。Computer Use 读取到对应模拟器页面实际可见，故归类为微信 DevTools/automator 会话环境阻塞。未弱化断言，也未修改产品源码。支付宝、抖音模板的真实页面交互和三端模板脚本/样式 HMR 尚未执行。
