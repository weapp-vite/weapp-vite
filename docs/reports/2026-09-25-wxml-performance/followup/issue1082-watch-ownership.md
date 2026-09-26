# Issue #1082：组件发现与复制资产的监听归属

本次从合并后的 main `d657d7b64bf2e5fb367862377255d513dab0ec07` 独立修复，未包含 #1085 的路径解析优化。关联 [#1082](https://github.com/weapp-vite/weapp-vite/issues/1082)，不会自动关闭该 Issue。

🔴 **完整性能验收尚未完成。** 本报告中的引擎回归、CLI 和 runtime 检查不构成三平台 7/20 对及唯一确认的性能结论。已有回退、不稳定、固定基线 sitemap 缺陷和独立包生命周期不可比较项继续保留。

## 已证明的根因

自动导入插件的 `buildStart` 原先无条件向原生引擎登记整个源码目录；即使明确关闭自动导入，也登记源码根。组件发现又有独立的过滤侧车。原生目录监听因此把无关文件的创建、删除及目录元数据变化交给 HMR，可能与有效脚本 Patch 混合并升级重建。

真实 Rolldown 1.2.10 DevEngine 对照：只监听入口文件时，新增无关 `buffer.note` 不触发更新；增加目录登记后，同样操作产生目录和该文件的 `watchChange` / `Noop`。实际自动导入插件回归在修复前失败，修复后保留连续编辑/恢复 Patch，并继续收到用户显式 `addWatchFile` 登记的隐藏依赖变化。

不能忽略全部 `Noop` 或模块图之外的文件：此前隔离 DevEngine 探针证明，`buildStart` / `generateBundle` 登记的真实依赖也可能产生 `Noop`，`load` / `transform` 依赖则可能产生 Patch；这些依赖不属于普通模块图成员。

## 资产归属必须同时修复

仅删除自动导入的宽监听会破坏 stateful 复制资产更新。四组普通 CLI 对照已证明：没有目录登记时，已有 PNG 扩展名文件、`copy.include` TXT 更新及新建均未更新；显式登记源码目录后这三项恢复。此前方案及真实 DevTools 复核失败已保存在 [证据 PR #1083](https://github.com/weapp-vite/weapp-vite/pull/1083) 的 `issue1082-watch-boundary-diagnostic.md`，不以新通过结果覆盖旧失败。

现在资产收集和监听共用 `plugins/asset/sources.ts`：默认扩展名、源根/插件根、输出排除、`copy.include/exclude/filter` 只定义一次。`filter(file, index, array)` 保留完整列表和索引契约，不能将其降为单事件文件过滤。监听按完整扫描结果同步已接受集合，过滤失败会报告错误并保留原归属，后续独立事件可恢复。

过滤侧车仅把真实复制资产事件交给现有快照构建。classic 通过串行构建控制器处理；stateful 通过现有会话调度处理。正常模块由原有模块监听处理；没有文件名黑名单、放宽 Patch 安全条件、修改计时轮询、手写输出或新增公开 API。

目录剪枝也有回归：`copy.exclude: ['nested']` 按现有文件匹配规则不能排除 `nested/new.txt`。监听不能因为目录名命中就忽略整个子树；只对确定的内部生成目录剪枝，其他排除保持文件语义。该用例在修正前失败、修正后通过。路径统一使用规范化分隔符，避免 Windows 事件路径与扫描集合不同。

自动导入侧车从已存在父目录建立监听，再剪枝到 glob 静态目录及必要祖先，覆盖启动后首次创建、目录删除后恢复、根通配符、部分文件名、brace/extglob 和负 glob 的数组 OR 语义。非开发构建及没有托管侧车的宿主保留原生监听。

## 验证及限制

- 产品定向测试 9 文件累计 176 项通过，覆盖真实 DevEngine、用户隐藏依赖、组件发现/删除恢复、glob 边界、复制选择与侧车、经典构建调度及既有 stateful 会话契约。
- 包级 `typecheck`、公开 `test:types` 和 `build` 通过。所有下游验证均在产品 `dist` 重建后串行执行。
- HMR 清单与 headless 传输基础设施 2 文件 12 项通过。新增资产 CLI 回归加入 `hmr-guard-manifest`，正常 CI 会执行；覆盖两种运行时、关闭自动导入、PNG/TXT 连续两次编辑和完整恢复、新文件及后续更新、exclude/filter 和 public 初次产物保留。
- provider-compatible 编辑器文件场景复用现有 stateful fixture、真实 AppID 和页面条件；同一 suite 只启动一次 automator，通过 `reLaunch` 进入原生页面，校验两轮脚本编辑/恢复的版本、递增行为、页面身份、输入、路由及 query，并采集 6 个 DOM 检查点。
- headless 测试适配只允许当前 CLI 控制文件的回环端点；收到真实 `batch-published` 才执行 bundler 已生成的补丁。其他请求保留 mock-only 网络，关闭时取消长轮询并恢复原方法。工具测试覆盖非发布响应不得执行、失败传播、端点隔离与清理。
- 自动导入 HMR guard 三个任务先前分别 9 / 2 / 5 例通过。新增代码未改变这些场景的断言或样本。

🔴 最初仅收窄自动导入的方案曾在真实 DevTools 最终复核中出现“补丁已生成、客户端版本仍为 0”。后续诊断增加 transport / lastApply 失败记录并补齐 DOM 计划；完整资产归属实现后的运行时结果单独记录。尚未证明这次历史超时的完整因果链，不能将所有发布协议异常标为已解决。

🔴 普通 CLI 探针中，public 文件后续更新在有/无源码目录登记的四组都未更新；这是保留的待查现象，本次只验证 public 初次输出不会受影响。复制资产删除后的最终输出裁剪也不在本次 CLI 已验证范围内；目录事件归属和组件删除/恢复有独立覆盖。不因上述局部修复关闭 #1082。

## 先前 CLI 诊断中的保留失败

此前正常 stateful CLI 原生模板的两轮编辑/恢复中，App JSON、App 样式、页面模板、页面脚本、页面样式及 sitemap 六项完成；脚本保留真实发布协议断言。其驱动使用 `best-of-cycle`，只是诊断，不能将选取值当完整性能门禁。

🔴 `json-theme` 在准备阶段失败：变更器只支持 `navigationBarTitleText` 或 `desc`，该主题文件不含对应字段，没有样本。整轮返回 1，不能记为全部通过；没有删场景、改预算或补采。

[原始 CLI JSON](./issue1082-watch-ownership-cli.json.gz) 保留所有逐次数据、阶段及错误。gzip 原文 SHA256：`f692ef23b3fe83e11c0397782d96f35f4e99b0071a9746add1670df982120467`。

## 首次交付的串行验证（后续 CI 仍发现遗漏）

最后一次产品构建后，在正常监听配置、未开启快照 trace 的情况下，CLI 两项、headless 一项、真实 DevTools 一项全部通过。两个 runtime provider 各采集 6/6 DOM 检查点，均无验收违规；连续两轮脚本编辑/恢复满足精确版本、行为及状态断言。该结果与前文早期失败分别保留，不能推导历史所有生命周期超时已经消失。

[最终交付诊断归档](./issue1082-watch-ownership-delivery.json.gz) 包含三项命令日志、两个 provider 的 DOM 报告和资产探针修复后结果，仅脱敏本地路径。gzip 原文 SHA256：`d1535fb39a4a934635d113a4dcb42f663d13eb6ef1f9f5c305b6f2cb3664246b`。

## 文件边界

新的资源选择、监听和组件目录计划放在独立小文件。既有超过 300 行的自动导入插件、build service、stateful session 和对应 harness 仅修改注册、事件路由与关闭点，避免为此重排大型生命周期文件。DOM 计划、headless 传输适配及其回归也独立成文件。行为修复包含 weapp-vite / create-weapp-vite 中文 patch changeset。

## CI 暴露的逻辑入口与独立子构建依赖遗漏

远端 `98d4d822` 的 Performance Smoke 通过，但 Ubuntu Node 22 的完整测试暴露 10 项失败。本地同样复现，其他 OS 不执行同一套完整测试，不能据此归因为平台差异。

- 8 项来自 snapshotTemplates 的 chokidar mock 把所有监听器共用为一个 EventEmitter。夹具现为每次 watch 创建独立对象，仍要求每个 watcher 只有一个 ready 订阅；删除恢复场景继续明确驱动 snapshot watcher。
- App Vue 修改 sitemap 路径时，原生事件已经抵达并分类为 `entry-json-only`，资产快照也能重新构建，但逻辑入口缓存没有因宿主源码读取而失效。逻辑加载器现通过 `addWatchFile` 声明源码读取关系，使侧车依赖列表随配置重新加载。覆盖路径切换、切回、后续编辑和完整恢复。
- 独立 WXML 文件存在于子构建 registry，却未登记给活动原生主引擎。主发布插件在等待子构建后接管精确依赖，子构建失败时也登记恢复所需文件。已有真实 watcher 用例覆盖连续更新、拒绝无效输出、修复后恢复及外部 WXML 依赖删除恢复。

只增加逻辑入口依赖时，headless 曾拒绝 native page 的逻辑包装补丁。进一步记录真实 transform 源码证明：首次加载与图恢复时，同一依赖集合的 JSON/script import 次序不同，导致包装模块发生无意义变化。新增真实引擎回归修正前得到两份不同源码（预期一份）；固定去重后的依赖 ID 排序后，编辑/恢复均保持同一包装源码。实际宿主源码仍是首个导入，增删真实依赖仍改变包装内容。没有扩大客户端接受边界、放松 Patch 判断或忽略发布协议。

🔴 调查过程中还保留一次 headless 启动传输错误（注册请求落入 mock-only 网络，未进入场景）；诊断运行中端点匹配正常，但尚未证明该次启动失败的完整原因。Wevu 样式场景在 headless 因 computed-style 能力检查被拒绝，也不能记为通过；真实 DevTools 结果单独记录。

## 本轮依赖修正的验证与交付阻塞

- 最终源码：12 个定向测试文件、113 项通过；包级 typecheck、test:types 和 build 通过。
- 最后重建 dist 后串行运行正常 CLI 资产用例，两种 runtime 共 2 项通过；headless 编辑器文件场景 1 项严格通过，6/6 DOM 检查点，无违规。
- 🔴 真实 DevTools 2.02.2609231 / 基础库 3.16.3 两项均未通过，共 4/14 检查点。原生脚本收到真实 `batch-published`，客户端版本仍为 0；Wevu 初始页面与准备状态通过，但已写入产物的模板新增节点未在 IDE DOM 出现。不能用文件内容替代 runtime 断言，也不能据此把缺陷归为编译成功。
- IDE 连接、预热和初始 DOM 均成功。尝试通过本机辅助访问读取 IDE 窗口被操作系统拒绝，当前没有可调用的 Computer Use 工具；这限制了 UI 排查，但不能证明以上 runtime 失败是环境问题。尚未确认根因，PR 保持草稿，不宣称 runtime 最终验收完成。

[本轮诊断与最终检查原始归档](./issue1082-owned-dependencies-delivery.json.gz) 保存首次 CI 本地复现、逻辑顺序回归、headless 各阶段失败、最终单测/CLI/runtime 日志和完整 DOM 报告；仅脱敏机器路径和回环端口。包含测试时三份产品源码 SHA256，未将未提交工作区的检查冒称远端 HEAD 验收。gzip 解压 JSON 共 278714 字节，SHA256：`a81d993ed288a04b990175547c1363bef2cb7c237e2f054c0fd4d10e903a2a87`。

三个产品变更文件均不足 300 行；新真实引擎回归单独成文件。已有大型 snapshot harness 只补齐实际插件上下文契约。固定基线和所有正式门禁均未改，#1082 保持开放。

## JSX 依赖归属补充（c9135f7f7 后续）

新 HEAD c9135f7f7 的全部 CI 为 30 success / 10 skipped / 1 failure；唯一失败是原有 `test/runtime/jsxStatefulHmr.test.ts`。Ubuntu Node 22 执行完整测试，其他 OS 没有执行同一套测试，不能称为 OS 专属回退。原先十项失败均不再出现，此次完整测试共 11489 项通过、1 项失败。

失败已在本机原样复现：页面 handler 更新时，客户端收到逻辑入口模块但找不到接受方。生成代码诊断证实，源码 transform 后发现的共享 JSX 依赖被后续逻辑入口 load 重新提升为额外 sidecar import，改变了包装模块；它不是已修复的同集合顺序漂移。JSX transform 已通过 `addWatchFile` 和模块图维护该依赖，本轮让逻辑入口不再导入或重置 JSX 类依赖，仍保留其他侧车的发现和更新规则。未放松客户端接受边界或 Patch 安全判断。

原回归用例新增逻辑入口重载后的 JSX 依赖存在断言，并连续验证共享模块再次编辑、页面恢复、客户端版本和引擎状态身份。6 文件 16 项定向测试通过，包级 typecheck/build 与 scoped ESLint 通过。这里的 VM 补丁执行验证是真实编译产物的局部契约，不能替代最终 DevTools 验收。先前真实 DevTools 两项失败仍保留，PR 继续草稿。

原始诊断与验证日志归档于 [issue1082-jsx-owner.json.gz](./issue1082-jsx-owner.json.gz)，解压 29369 字节，SHA256 `05310cae6fe53a07e680d0d98ea811d3ecca7931b0fac365c29724649a62afe2`。仅脱敏路径/本机端口并移除终端颜色，未更改结果。

进一步只读调查发现：先前通过运行的 IDE 文件服务 `enableContentDiff=true`，失败运行为 false；失败轮日志没有 update.js 或模板的 change 事件，只有 add/unlink。已安装 IDE 的事件合并器忽略普通 change，仅把 contentChange 转为编译 change，而内容差异事件受上述开关控制。这解释了一个可能的事件断点，但尚未确定开关差异来源或用真实 IDE 完成因果验证；没有修改安装的 IDE、强制执行补丁、手写产物或据此将失败判为环境通过。

## 显式项目类型后的受控 DevTools 诊断

`c5da308a4` 的 GitHub 检查已全部结束：31 success / 10 skipped。以下本地诊断在相同产品源码及已重建 dist 上执行，仅在 stateful fixture 中显式声明标准 `compileType: "miniprogram"`，不再依赖 IDE 自动补写项目类型。未修改产品逻辑或断言，两项命令串行运行并均已退出。

- 🟢 原生编辑器文件场景：1 项通过，6/6 DOM 检查点；两轮脚本编辑与恢复满足客户端版本、页面身份、计数、输入和路由断言。IDE 日志显示 `enableContentDiff=true`，存在 update.js 变更事件。单次恢复不足以证明此前监听开关变化的根因已经解决。
- 🔴 Wevu 场景：1 项失败，仅完成 2/8 DOM 检查点。初始页面和准备状态通过；`template-b` 的 `.sfc-template` 期望 1 个，实际 0 个。产物内容检查已通过，但尚未到模板恢复及脚本补丁阶段。失败截图保留计数 2 和输入状态，未出现新增模板节点。
- 两次运行均启用内容差异监听。Wevu 日志在 08:34:17.479（UTC+8）记录 `dist/pages/wevu/index.wxml` 的 change，说明不能再用“IDE 未收到文件变更”解释这次失败。其 `transWXMLToJS` 调用在 08:34:17.087 / .107，早于合并事件分发；缓存失效与模板重新编译时序是下一步调查线索，尚未证明因果关系。08:34:33 的第二组变更来自失败后的 finally 恢复，不是模板恢复检查通过。

本次未修改已安装 IDE、强制应用补丁、手写构建输出或放宽 DOM 检查。Wevu 最终 runtime 验收仍未完成，PR 保持草稿；此前所有失败继续保留。项目类型属于测试夹具声明，本轮不新增产品 changeset，也不将正确性诊断当作正式性能验收。

[完整命令日志、DOM 报告及 IDE 日志](./issue1082-explicit-project-type.json.gz) 仅脱敏机器路径、项目标识及回环端口，解压 779677 字节，SHA256 `f44d8fe8ee90316b5e9f1a6de23a940fce5daff57c7718a537bbd48332397ccb`。[Wevu 失败截图](./issue1082-wevu-template-b.png) 来自同次运行。
