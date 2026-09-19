# #977 最新主线连续 HMR 复核

## 基线与范围

2026-09-19 在 main `7161aaa1f2179f78e95601b767534b2076067714` 的隔离工程重跑真实微信开发者工具。工作区安装锁文件依赖并重建 weapp-vite、wevu 及依赖包；默认及固定 catalog 的 weapp-tailwindcss 均为 5.5.6。本次不是 npm 发布版验收，没有把本地源码构建描述成发布修复。

使用 IDE 2.02.2608070、实际基础库 3.17.3、WebView。公共与私有项目配置均开启 `compileHotReLoad`。工程明确链接模板声明的依赖并核对真实包目录，消除此前子工程未声明 wevu 的复现差异。

回归入口是 `e2e/ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts`。本轮加强为三轮独立工程，每轮一次 automator 会话、连续七个检查点；轮内不重新启动页面。颜色来自真实页面计算样式，检查点击计数、页面身份、App 标记及启动时间。未修改产品源码、弱化断言或补写 bundle。

## 实际结果

### 2026-09-19 严格复核与发布顺序对照

修正原生 Component 配置后，以 `WEAPP_VITE_E2E_DOM_ACCEPTANCE=1` 重新执行 Page 与 Component 各三轮。6 个 case、42 个 checkpoint 全部通过；每轮七步颜色、局部优先级、点击状态、页面身份、App 身份和启动时间均保持，运行时错误为零。此前首次启动的 `current-page` 协议暂态在复核中没有复现。

随后在未修改产品源码的基线重新运行完整模板三轮。严格结果为 1/3 case、15/21 checkpoint：第一轮 `local-style-priority` 仍显示粉色而不是深色，第三轮第一次蓝色更新仍为透明；第二轮七项全部通过。失败时 WXML、全局 WXSS 和页面 WXSS 均已落盘，页面/App 身份和点击状态保持。

为验证单次 Vite write 中的资产顺序是否为框架根因，临时将 refresh 发布拆成两个由 Vite/Rolldown 持有的阶段：先写样式资产，再写模板等消费者。三轮严格结果仍为 1/3 case、15/21 checkpoint，失败点同样是局部深色未应用和蓝色背景保持透明。该实验已经撤回，没有进入待提交源码。它证明单纯调整磁盘写入顺序不能建立宿主编译确认屏障，也不能作为兼容修复。

| 轮次 | 检查点 | 结果 |
| --- | --- | --- |
| 1 | 前六项 | 通过，颜色与状态正确 |
| 1 | local-style-priority | 失败：预期 rgb(31, 41, 55)，实际 rgb(252, 231, 243) |
| 2 | 全部七项 | 通过，页面身份、App、启动时间和点击计数保持 |
| 3 | 初始与点击状态 | 通过 |
| 3 | background:2 | 失败：蓝色更新后仍透明，预期 rgb(219, 234, 254)，实际 rgba(0, 0, 0, 0) |
| 3 | 后四项 | 首个 DOM 失败后未执行，不记为通过 |

合计计划 21 个检查点，15 个通过、2 个失败、4 个未执行；三项 case 中一项通过、两项失败。两类失败均与原 issue 已记录的现象一致。报告截图和文件摘要保留在本地生成证据中，不提交包含机器信息的原始日志。

本次使用直接 Vitest 入口，报告的 `strict` 字段为 false；所有 DOM、身份、计数和异常断言仍保留，失败会使命令非零退出。这些结果用于复现失败，不能当作通过严格全量验收。启动期间另有自行恢复的 current-page 协议重试，应与运行中的样式失败分开记录。

进一步比较文件证据：第一轮失败后的页面 WXSS 已包含 `#1f2937`，但局部节点仍呈粉色；第三轮失败后的 WXML 已有蓝色 class，全局和页面 WXSS 均含 `#dbeafe`，页面却保持透明。诊断 wrapper 与 dist 对应文件具有相同哈希。最新严格复核再次得到相同类别的结果。

这些结果排除了“最终输出未包含目标规则”作为这两次失败的解释，但没有排除编译中间状态、发布顺序或宿主缓存的问题。DOM 验收本身会重试至 15 秒，并非读取文件后只立即检查一次。因此下一步需要观察完整提交及宿主样式应用过程，不能通过延长固定等待或降低颜色断言作结论。

## 结论与后续

### 原生发布对照

新增 `e2e/ide/issue-977-native-style-diagnostic.runtime.test.ts`，将七步序列最小化为原生 App/Page、普通 CSS、WXML 与局部规则。每次只向 Vite emit 内容变化的资产，保持 App/Page 脚本不变，无开发服务器、Tailwind 或 Wevu。最初 Page 版本在真实 IDE 严格模式下三轮全部通过：3/3 case、21/21 checkpoint，页面/App 身份、启动时间及点击计数均保持。

此前根据模板配置中的 `virtualHost:true + apply-shared` 补充了 Component 对照。该版本尚未进入更新阶段：首屏节点有逻辑 WXML，但 CSS 与 XPath 查询均返回空计算样式和零尺寸。补充页面 JSON 的 `usingComponents`、`component` 声明也未解决。Computer Use 未能完成可视检查，不能把这些首屏结果归类为 #977 的 HMR 复现。

进一步重建并检查实际模板产物后发现，对照中的 `virtualHost:true` 不准确：App 默认配置仍保留 true，但页面 JS 显式设置 `virtualHost:false, styleIsolation:'apply-shared'`，页面 JSON 没有 `component:true`。编译器的 `transformScript/rewrite/defaults.ts` 会从组件默认值中剥离 virtualHost，并补 false；现有 defaults 单测覆盖了这一行为。共享原生 fixture 已按实际页面产物改为 false，并去掉额外 component 声明。此前 null 样式不能证明模板同样无法渲染，也不能在尚未复跑时断言这处更正已解决真实 IDE 首屏问题。

原生 Page/Component 文件生成已收敛到 `mpcore/packages/simulator/test/helpers/nativeStyleHmr.ts`。更正 virtualHost 与页面 JSON 后重跑：Node 与 browser logical runtime 共四个状态用例通过；`nativeStyleHmr.e2e.test.ts` 通过真实浏览器预览验证 Page 和 Component 的七步计算颜色、局部优先级及点击状态，两项通过。simulator typecheck 与 ESLint 通过。没有公共类型变化，不新增类型契约或 changeset。

该浏览器对照显式更新虚拟文件，不模拟微信 IDE 的文件监听或原生 WXSS 编译时序。真实 IDE 的 Page 与 Component 对照现已完成严格复核并通过，但它们仍不能用来认定完整模板问题已修复；完整模板三轮仍可稳定采到间歇失败。

### 构建发布追踪

使用现有 `WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE=1` 在模板隔离副本中连续执行蓝色、删除背景、恢复黄色、粉色、新增局部规则五次修改。初始构建后每次修改均仅产生一个 refresh 写入批次，批次按顺序结束；每个 write-end 的磁盘 SHA-256 都与 write-start 的目标资产一致。App JS、页面 JS 和页面 JSON 在五次更新间均保持相同哈希。

前四次更新各发布页面 WXML、全局 WXSS、页面 WXSS；最后新增局部规则仅发布页面 WXML 和页面 WXSS。最终局部规则存在于页面 WXSS 中，全局 WXSS 未改写。这次无 IDE 的诊断没有发现重复发布、JS 替换或错误快照落盘，但不观测 Vite 单个批次内文件完成的实际先后，也没有证明宿主按同一批次应用 WXML 和 WXSS。它不能解释或否定此前真实 IDE 的间歇失败。

最新主线及 weapp-tailwindcss 5.5.6 下问题仍存在。明确依赖后也能失败，不能将此前三轮成功归因于依赖声明，更不能依据一次通过关闭 issue。

保留 #1028 的页面样式刷新改进；当前证据不足以证明它根除了宿主混合更新调度缺陷。本轮没有确认新的框架根因，因此没有添加产品补丁或 changeset。下一步应对失败的样式请求继续采集宿主编译返回与样式分发证据，保持真实颜色和状态断言。

复现前按仓库约束检查残留进程并保持全局串行：

```sh
pnpm --filter weapp-vite... --filter wevu... -r build
WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE=1 caffeinate -dimsu pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts
```
