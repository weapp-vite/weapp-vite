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

## 最终源码的串行交付验证

最后一次产品构建后，在正常监听配置、未开启快照 trace 的情况下，CLI 两项、headless 一项、真实 DevTools 一项全部通过。两个 runtime provider 各采集 6/6 DOM 检查点，均无验收违规；连续两轮脚本编辑/恢复满足精确版本、行为及状态断言。该结果与前文早期失败分别保留，不能推导历史所有生命周期超时已经消失。

[最终交付诊断归档](./issue1082-watch-ownership-delivery.json.gz) 包含三项命令日志、两个 provider 的 DOM 报告和资产探针修复后结果，仅脱敏本地路径。gzip 原文 SHA256：`d1535fb39a4a934635d113a4dcb42f663d13eb6ef1f9f5c305b6f2cb3664246b`。

## 文件边界

新的资源选择、监听和组件目录计划放在独立小文件。既有超过 300 行的自动导入插件、build service、stateful session 和对应 harness 仅修改注册、事件路由与关闭点，避免为此重排大型生命周期文件。DOM 计划、headless 传输适配及其回归也独立成文件。行为修复包含 weapp-vite / create-weapp-vite 中文 patch changeset。
