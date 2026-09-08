# Tailwind 开发快照内存验收

## 故障与生命周期

全量性能 CI 中，普通 Tailwind、TDesign、Vant 模板的开发进程在非脚本更新后持续增加约 135 MiB 的 post-GC heap。基线与 PR 构建均出现此问题；Ubuntu 接近 4 GiB、macOS 接近 2 GiB 时发生 OOM。脚本原生 patch 不产生同等增长，问题集中于重新生成模板、样式和元数据的快照。

`createStatefulHmrSnapshotOptions()` 为每次快照创建独立编译上下文。快照保留开发编译语义，但执行的是 `build({ watch: undefined, write: false })`。原 Tailwind 插件在 `closeBundle` 中以 `isDev` 决定是否释放 compiler，使这些一次性构建只能等待永远不会触发的 `closeWatcher`。

修复后依据真实控制器判断资源寿命：`command === 'serve'` 或 `build.watch` 为长期控制器，其余构建在 `closeBundle` 或失败的 `buildEnd` 中释放资源；多次关闭共享同一个释放 Promise。编译产物仍由 Vite/Rolldown 生成与写入。

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
