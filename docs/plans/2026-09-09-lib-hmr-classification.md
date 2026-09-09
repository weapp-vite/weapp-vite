# lib 模板状态保持 HMR 分类修复

## 已确认根因

源文件事件携带的 `entry-style-only` 分类原本只写入共享性能诊断状态。组件侧车引起的其他事件可覆盖该状态，而原生 patch 到达时仍读取共享值，导致样式更新被误判为需要完整构建。现在由 session 保存各源文件最新事件的分类，patch 仅消费自身文件对应的记录。资产快照完成不会提前消费分类，以覆盖快照先完成、原生 patch 后到达的顺序；完整构建仅释放其捕获的事件对象，保留同一路径的新事件。

另一个入口误判来自本轮扫描的注册集合与原生引擎持久模块图混用。元数据扫描清空本轮集合、缓存入口没有重新执行 emit 后，后续部分扫描把仍在原生图中的布局入口当作新增入口，提升入口图版本并阻塞当前原生脚本 patch。现在以插件上下文的原生模块图 `isEntry` 作为缓存入口的判定依据；真正新增入口仍请求完整构建。

## 回归覆盖

- 多个源文件的分类不受无关诊断覆盖，消费一个文件不会清除另一个文件。
- 同一路径的新事件替代旧分类；Noop 消费已处理分类。
- 样式快照完成后到达的 using-component 原生 patch 不触发多余完整构建。
- 真实 DevEngine 在入口 emit 集合被清空后仍识别已有入口；原有新增、删除和重新添加入口覆盖保持有效。
- 最小回归共 3 个文件、40 个测试通过；拥有包的 typecheck 与改动路径 ESLint 通过。

## 实际验证与边界

修复后的 `weapp-vite-lib-template` 完整 HMR benchmark 保持原始顺序，10 个场景全部完成，场景失败数为 0，原有样式 marker 丢失与原生脚本 patch 超时未再出现。默认 500 ms 预算仍有 4 个场景超限，最大值约 555 ms，因此该 benchmark 命令仍以非零退出；这里不将语义通过写成性能验收通过，也不替代最终真实 IDE DOM 验收。

最后的反事实诊断仅恢复旧共享分类、保留原生入口图修复。`MAX_SCENARIOS_PER_TEMPLATE` 会按优先级重新选择顺序，该局部运行不等同原始失败顺序。其 4 个场景完成、1 个超预算，观察到样式恢复引发多余完整构建；该次完整输出仍绑定当前快照，未证明完整输出归属另有缺陷。原始顺序下 marker 丢失的具体输出细节尚未完全解释，不据此增加输出写入兜底。

本地完整证据索引：

- `.tmp/lib-hmr-fixed/report/report.json`：修复后的完整 10 场景。
- `.tmp/lib-hmr-diagnostic/report/report.json`：原始分类与入口判定问题的诊断。
- `.tmp/lib-output-owner-style/report/report.json`：改变顺序的反事实局部诊断，仅用于边界说明。
- `.tmp/lib-hmr-unit-final.log`、`.tmp/lib-hmr-typecheck-final.log`、`.tmp/lib-hmr-lint-final.log`：最小静态和回归验证。

`session.ts` 原已超过 300 行；本次分类消费与现有快照事务共享生命周期，保留在 session 中以避免将同一事务状态拆散。入口生命周期独立文件保持原有边界。全部产物仍由现有 Vite/Rolldown 写入链持久化。

## 十轮云端诊断的补充根因

诊断运行 [34297074519](https://github.com/weapp-vite/weapp-vite/actions/runs/34297074519) 使用候选 `d594161cc`、原有 lib 全 10 个场景及每场景 10 轮 edit/restore，显式启用 snapshot trace。Ubuntu 与 macOS 复现失败，Windows 的候选 10 个场景各完成 10 轮。三平台历史基线仍有脚本失败，不能把 Windows 候选通过写成整个比较成功。trace 有额外读取与哈希开销，本记录不替代最终无 trace 的全量验收。

Ubuntu 样式恢复的 batch 28 已生成正确的 242 字节 WXSS，源码前后摘要均为恢复后的内容。但 batch 被提升为 full 后只出现 additional 写入，正确样式未发布；下一次 app.json refresh 才写回它。macOS 的模板恢复和样式恢复分别在 batch 9、12 呈现同样顺序：正确快照已经生成，附加输出完成后该批就结束。说明早先“磁盘输出旧”的观察不能归因于源码缓存，也不能仅补写一个 WXSS 文件。

真实 native watcher 回归进一步证明了裁剪根因：修改 owner 并重复 emit 组件入口后，原生完整构建的 bundle 本来含 `app.js`，但 classic HMR finalizer 根据遗留的 `profile.event` 和本轮重新 emit 的入口集合，将它裁成只剩组件。bundled dev 模式应由原生引擎负责 bundle 范围，不能复用 classic HMR 的增量裁剪；classic 模式仍保留现有裁剪行为。

交付边界也须明确：原生 Full/Partial 扫描共用 `onOutput`，回调名称本身不代表完整构建。adapter 保留原生 bundle 与 additional 来源，完整重建等待自身实际完整输出及持久化完成，部分或附加输出不能替代该确认。发起新完整构建前，应先结束旧原生构建及其输出任务，再绑定新快照事务，避免旧回调用新快照造成短暂的新旧产物混合。缺完整输出或写入失败必须明确失败，产物仍由 Vite/Rolldown 写入。

Ubuntu 的原生页面脚本失败另有一条链：本次修改尚未被 patch 验收时，已存在的默认布局被报告为 `entry-graph-changed` 并触发 full rebuild。完整入口虽然含新 marker，但状态保持 patch 未通过；恢复后原始入口仍含编辑 marker，不能用读取文件代替 patch 验收。保持现有严格 gate。

实际 loader 回归已复现布局身份空窗：先清空依赖、再异步解析布局，会让原本已注册的布局暂时无法被 `isLogicalLayoutEntry` 识别。修复以一次性发布完整依赖代替提前清空；解析失败保留上一版依赖，无布局时才最终清空，输出阶段不能将传递依赖降级为直接依赖。该回归证明实现问题，云端脚本失败是否完全由此解决仍需原顺序重跑确认。

验收分层保留：loader 与依赖图单测证明原子发布；adapter/session 单测证明完整与附加输出隔离及失败传播；真实原生 DevEngine 回归验证构建完成屏障的回调顺序；最后重建 CLI，在原场景顺序完成 lib 十轮、完整模板性能及真实 IDE DOM 验收。定向单测通过不能替代后两层结果。

## 修复后无 trace 复验

最新完整输出裁剪、输出确认和布局依赖原子发布修复重建 CLI 后，lib 原有 10 个场景分别完成 10 轮编辑与恢复，所有场景各有 10 个有效样本、0 失败。现有性能预算仍有 8 项超限，最大观测约 1104 ms，不能据此宣称性能验收通过。证据保存在本机 `lib-complete-bundle-ten-rounds.log` 对应索引中。

云端完整 workspace HMR 的失败应用 `apps/wevu-jsx-tsx-demo` 也按原顺序单独复验：native script、Vue template、Vue script 共 3 个场景全部通过，包含每次恢复 gate，0 未执行。该运行未启用 trace、未延长原有超时，报告明确标记为单应用筛选结果；仍需最终提交上的全量 workspace HMR 和真实 IDE DOM 验收。
