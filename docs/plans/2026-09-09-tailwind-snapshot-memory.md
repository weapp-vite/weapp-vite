# Tailwind 开发快照内存验收

## 故障与生命周期

全量性能 CI 中，普通 Tailwind、TDesign、Vant 模板的开发进程在非脚本更新后持续增加约 135 MiB 的 post-GC heap。基线与 PR 构建均出现此问题；Ubuntu 接近 4 GiB、macOS 接近 2 GiB 时发生 OOM。脚本原生 patch 不产生同等增长，问题集中于重新生成模板、样式和元数据的快照。

`createStatefulHmrSnapshotOptions()` 为每次快照创建独立编译上下文。快照保留开发编译语义，但执行的是 `build({ watch: undefined, write: false })`。原 Tailwind 插件在 `closeBundle` 中以 `isDev` 决定是否释放 compiler，使这些一次性构建只能等待永远不会触发的 `closeWatcher`。

资源寿命由实际控制器所有权决定，不能仅依据开发语义或 Vite 配置标志。`command === 'serve'` 与 `build.watch` 能识别 Vite 自带控制器；classic 模式则由框架持有 watcher service 租约，复用同一组插件反复执行一次性 Vite build。Tailwind 在构建结束时将释放回调登记到该租约，最后一个控制器关闭时等待释放。无控制器的一次性快照仍在 `closeBundle` 或失败的 `buildEnd` 及时释放；多次关闭共享同一个释放 Promise。编译产物仍由 Vite/Rolldown 生成与写入。

## 本机对照证据

基于提交 `234b` 所在开发分支的构建产物保留修复前 CLI，修复后重建 `weapp-vite`。修复后构建同时包含同轮 lib 样式归属与 React bridge 改动；本对照选用不涉及这两项的原生 Tailwind 模板。结果属于提交前定向证据，不能替代最终提交的完整 IDE/CI 验收。

两侧运行相同的 `scripts/benchmark-templates-hmr.ts`，选择 `weapp-vite-tailwindcss-template`，每个场景执行 2 次编辑/恢复循环，共 7 个场景。环境仅设置模板筛选、迭代次数、独立 workspace/report 路径、保留 workspace 和失败返回非零；修复前另指定保留的 CLI。未覆盖 heap、500 ms 默认预算或超时配置。长任务使用系统唤醒保护，全部串行运行。

采样由 `sampleHeapAfterGc()` 在受测开发子进程中执行 `global.gc()` 后读取 `process.memoryUsage()`。报告按原有 best-of-cycle 策略保留每组编辑/恢复中的一个采样，因此下表代表已保留样本，不是所有采样的峰值。

| 场景                 | 修复前 heap（MiB）   | 修复后 heap（MiB） |
| -------------------- | -------------------- | ------------------ |
| app-json             | 752.1、888.6         | 416.1、420.0       |
| app-style            | 1365.5、1706.4       | 492.3、564.7       |
| native-page-template | 1978.3、2250.2       | 566.6、569.9       |
| native-page-script   | 2250.1、2388.2       | 571.7、575.0       |
| native-page-style    | 2658.4、3065.8       | 578.7、581.9       |
| json-sitemap         | 3201.6、3473.2       | 583.6、588.4       |
| json-theme           | 3744.9；后续恢复失败 | 591.6、593.1       |

修复前日志包含 `FATAL ERROR: Ineffective mark-compacts near heap limit`，最后一次 GC 后约 4021 MiB；theme 恢复最终超时。修复后 7 个场景、14 个保留样本全部完成，无场景错误。两侧命令均返回非零：修复前存在场景失败和预算超限；修复后仅有 6 个场景超过原有 500 ms 性能预算，不能记为性能 CI 通过。

本机证据索引：`.tmp/tailwind-lifecycle-before/report/report.json`、`.tmp/tailwind-lifecycle-after/report/report.json` 及各自 `logs/weapp-vite-tailwindcss-template.dev.log`。完整原始证据不纳入提交。

## 回归覆盖与边界

`plugins/tailwindcss/lifecycle.test.ts` 覆盖连续一次性开发快照、长期 build watch、serve、失败快照的并发关闭等待，以及未使用 compiler 时的惰性关闭。结合既有 Tailwind 用例，定向验证 24 个测试通过；owning package typecheck 与对应 ESLint 通过。

主泄漏已由真实对照证明显著收敛，但 CSS 源变化仍有可见的额外增长，当前证据未证明长期内存完全稳定。依赖中的 design-system/source 缓存需要后续独立保活链分析，不能仅凭两个 CSS 修改样本断言上游泄漏或通过放宽 heap 掩盖它。

本次保留现有 Tailwind 插件文件结构，资源创建、关闭钩子与现有 compiler 缓存共用同一闭包；将新增回归独立放入 `tailwindcss/`，避免进一步扩大既有测试文件。

## classic 全量回归补充

提交 `0f3ad9456` 的全量 `e2e:ci` 在 `template-wevu-tdesign-retail-hmr-vendor.test.ts` 暴露了上述控制器判定的遗漏。三个 case 首次构建正常，首次 HMR 都在 Tailwind `invalidate` 抛出 `Compiler 已释放`，最终因输出 marker 缺失超时；运行模式明确为 classic。不能把这一失败解释成 stateful 补丁分类或原生入口图问题。

修复复用 `retainWatcherService` 已有租约，由 `deferWatcherResourceCleanup` 按回调身份去重登记资源释放。最终 owner 退出时等待所有回调与 watcher service 关闭；一个回调失败仍执行其余资源清理，并将清理错误传回调用方。没有 owner 时返回给调用方立即清理，不增加 `isDev` 例外，也不重新创建已释放的 compiler 掩盖所有权错误。

新增 `tailwindcss/classicLifecycle.test.ts` 使用真实 Vite build 与真实 Tailwind compiler，连续复用同一插件组，验证第二轮 `buildStart` 的失效通知和输出样式仍工作；两个控制器逐个退出，最后退出后实际 compiler 拒绝再使用。另一个真实构建覆盖无 owner 的开发快照仍在 bundle 关闭时释放。既有 watcher service 测试增加多 owner、异步清理等待、回调去重与单个清理失败后的完整回收。

本次没有扩大编译器 API；新增清理登记函数是内部构建控制器边界。`watcherPlugin.ts` 保持小于 300 行，真实构建回归独立存放于 `tailwindcss/`。既有大文件 `tailwindcss.ts` 只将快照关闭策略收敛为一个闭包内函数，继续让 compiler 缓存及 dispose Promise 共用同一所有者。

真实生命周期对照已完成：仅恢复修复前 Tailwind 关闭策略时，连续构建在第二轮 `buildStart -> invalidate` 稳定抛出 `Compiler 已释放`，一次性快照 case 仍通过；恢复控制器租约后，两个真实 Vite case 与既有纯生命周期覆盖共 3 个文件、28 个测试全部通过。证据为 `.tmp/tailwind-classic-real-red.log` 与 `.tmp/tailwind-classic-real-green.log`。拥有包 typecheck 和改动路径 ESLint 通过。

重建 `weapp-vite` 后串行运行现成下游回归：零售模板 vendor HMR 的 3 个 case 通过；`issue-814-tailwind4` 内存守卫通过，post-GC 堆增长 1.0 MiB（上限 180 MiB）；全部 5 个 Tailwind 模板 HMR 通过，post-GC 堆增长依次为 90.3、84.2、108.1、69.2、12.7 MiB，均低于原有 160 MiB 上限。模板输出、CSS 更新及旧样式移除断言完整保留，未增加 heap、超时或性能预算。日志索引：`.tmp/tailwind-classic-retail.log`、`.tmp/tailwind-classic-memory.log`、`.tmp/tailwind-classic-templates.log`。这些是本次修复后的定向验证，最终提交全量验收另行执行。
