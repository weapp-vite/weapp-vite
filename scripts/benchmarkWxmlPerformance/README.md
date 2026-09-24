# WXML 性能基准

用于区分默认构建成本、新能力成本和实现复杂度。与仓库其他 E2E、watcher 及性能命令串行运行。JSON 报告只记录提交、平台、场景和样本，不记录机器路径。

## 准备

使用独立 checkout 固定 main、优化前、优化后三份完整 SHA。各自安装依赖并构建 `weapp-vite` 的依赖闭包；不能共用指向另一 checkout 的 workspace 包链接。原始样本保存在 `.tmp/wxml-performance`，发布报告时仅复制已核验的数据。

`index.ts` 在被测 checkout 的 `.tmp` 下用 esbuild 生成独立 ESM 模块，外部包仍来自该 checkout。准备时间不计入样本；不用 tsx 的辅助函数命名开销代表发布包成本。整个构建/HMR 则使用真实 CLI/dist。

## 微基准

设置以下环境变量后运行：

| 环境变量 | 含义 |
| --- | --- |
| `WXML_PERF_ROOT` | 被测 checkout，默认当前目录 |
| `WXML_PERF_OUTPUT` | JSON 输出文件 |
| `WXML_PERF_SAMPLES` | 至少 15，默认 15 |
| `WXML_PERF_FILTER` | 可选的场景名称子串 |

```sh
node --expose-gc --import tsx scripts/benchmarkWxmlPerformance/index.ts
```

每个场景预热 5 次；GC 在计时之外。保留全部样本、median/P95、RSS、堆占用及 GC 后的堆差值。后者包含刻意保留的结果和 JIT/cache，不能单凭它宣称泄漏；应结合失败恢复、关闭后登记表和稳定句柄的确定性回归。

覆盖注释、精确/通配符清理、整节点删除、关闭及字符串/数组转换、同步/异步/XML 编辑、子树跳过和手动遍历、深树、源码校验/单次及多次 walk、三阶段组合、共享/独立依赖和连续失败恢复。公共基线包含 Vue 默认编译、保留注释后清理、simulator 解析/WXS/插值和公开 session 渲染。main 没有的新 API 不建立跨版本等价比较。

所有样本同时检查输出或回调次数。失败即终止，不用失败或缺失样本计算通过结论。

## 成对复测

先为两份 checkout 运行微基准以生成模块。设置 `WXML_PERF_BASELINE_ROOT`、`WXML_PERF_ROOT` 和 `WXML_PERF_OUTPUT`，运行：

```sh
node --expose-gc --import tsx scripts/benchmarkWxmlPerformance/paired.ts
```

可用 `WXML_PERF_FILTER` 按场景名称子串筛选复测。公共场景预热 10 对，再采样 20 对，逐对交换先后顺序。快速操作使用两边完全相同的批量，报告折算的单次耗时。默认路径超过 5% 的差异需要结合成对复测定位，不能用所有场景的平均值掩盖个别退化。

## 整个构建与 HMR

复用 `scripts/compare-templates-performance.ts`，分别对 main/优化前、main/优化后执行。将 `TEMPLATES_PERF_BUILD_ITERATIONS` 设为 7、`TEMPLATES_PERF_HMR_ITERATIONS` 设为 20、`TEMPLATES_PERF_HMR_SAMPLE_MODE` 设为 `edit-only`、`TEMPLATES_PERF_ASSERT_APP_OUTPUTS` 设为 `1`。三类模板筛选为 `weapp-vite-template,weapp-vite-wevu-template,weapp-vite-tailwindcss-tdesign-template`。保留首次构建、后续构建、每个 HMR 场景和进程树内存样本；首次构建不等同于清空操作系统文件缓存。产物检查覆盖 app 清单声明的主包/分包页面，并记录页面数量和校验和；缺失页面文件的构建样本按失败处理。该选项仅用于 app 模板，不对 lib/plugin 模板套用 app 清单。

补充分包和外部规则场景时，设置 `WXML_PERF_ROOT`、`WXML_PERF_OUTPUT`，以及可选的 `WXML_PERF_ENABLED=1`，运行：

```sh
node --expose-gc --import tsx scripts/benchmarkWxmlPerformance/watch.ts
```

使用固定的 WXML fixture 和被测 checkout 的 dist，分别运行 classic/stateful。每个原生、Vue、普通分包、独立分包磁盘修改场景采样 20 次；启用功能后额外采样共享依赖变化和删除恢复，各 20 次。保持前次编译输入独立，检查转换标记只出现一次，关闭后检查增量引用集合已释放。需要先重建受影响包，且不可与另一个 E2E 或基准并发。

仅重测生产构建时，设置 `WXML_PERF_ROOT` 和 `WXML_PERF_OUTPUT`，运行 `pnpm exec tsx scripts/benchmarkWxmlPerformance/build.ts`。它串行运行上述三类模板、每类 7 次，使用同一进程树 RSS 采样器并逐次检查 app 页面产物；不替代 HMR 采样。

针对 HMR 的单场景复测可直接运行 `scripts/benchmark-templates-hmr.ts`，用 `TEMPLATES_HMR_SCENARIO_FILTER` 指定逗号分隔的精确场景 ID（例如 `native-page-script,vue-page-script`），同时保留模板筛选及 20 次采样。交换 checkout 的测量顺序；单场景新会话与整套场景中的热态结果分开报告。未匹配任何场景仍按失败处理。

`watch.ts` 支持 `WXML_PERF_RUNTIME` 单独选择 `classic` 或 `stateful-experimental`，以及 `WXML_PERF_FILTER` / `WXML_PERF_EXCLUDE` 按输出路径子串缩小诊断范围。筛选条件写入 JSON，筛选运行不能代替被排除场景的验收。旧 baseline 若完成采样后因遗留 watcher 无法退出，必须记录生命周期失败并终止该进程，再测下一个场景；不能把缺样本或强制结束当作完整通过。
