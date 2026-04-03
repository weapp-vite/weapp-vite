# autoImportComponents Benchmark Final Report

日期：`2026-04-03`

脚本：`packages/weapp-vite/scripts/benchmark-auto-import-resolver.ts`

support-files benchmark 命令：

```sh
BENCH_ITERATIONS=3 pnpm --filter weapp-vite run benchmark:auto-import
```

full build benchmark 命令：

```sh
BENCH_ITERATIONS=3 pnpm --filter weapp-vite run benchmark:auto-import:build
```

## 目的

本次 benchmark 主要回答三个问题：

1. 关闭 `autoImportComponents` 与开启当前按需自动导入实现时，一个项目的支持文件同步耗时差多少。
2. 当前按需实现与旧的“全量 resolver 组件预热”行为相比，能快多少。
3. 在完整 `weapp-vite build` 链路里，关闭自动导入和开启自动导入时总构建时间差多少。

## 测试口径

- 基于 `test/fixture-projects/weapp-vite/auto-import` 临时复制工程执行。
- 在临时工程中新增一个页面，分别放入 `1 / 5 / 20` 个 Vant 标签。
- 自动导入相关支持文件全部开启：
  - `typedComponents: true`
  - `vueComponents: true`
  - `htmlCustomData: true`
- 比较三个模式：
  - `disabled`：关闭 `autoImportComponents`
  - `current`：当前实现，只为模板实际命中的 resolver 组件生成支持文件
  - `legacy`：模拟旧行为，预热全部 `VantResolver` 组件
- support-files benchmark 的计时范围是 `syncProjectSupportFiles()`。
- full build benchmark 的计时范围是完整 `weapp-vite build`。

## 环境说明

- 运行地点：本地工作树
- 迭代次数：`3`
- `VantResolver` 总组件数：`69`

## 结果

### A. support-files benchmark

| 场景 | disabled avg | current avg | legacy avg | 开启自动导入额外成本 | 相对旧行为节省 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 使用 1 个 Vant 组件 | 4.47 ms | 66.05 ms | 338.09 ms | 61.58 ms（1377.39%） | 272.04 ms（80.46%） |
| 使用 5 个 Vant 组件 | 1.16 ms | 142.79 ms | 265.02 ms | 141.63 ms（12229.04%） | 122.23 ms（46.12%） |
| 使用 20 个 Vant 组件 | 1.23 ms | 120.01 ms | 311.55 ms | 118.78 ms（9687.07%） | 191.55 ms（61.48%） |

### B. full build benchmark

| 场景 | disabled avg | current avg | 开启自动导入额外成本 |
| --- | ---: | ---: | ---: |
| 使用 1 个 Vant 组件 | 1021.61 ms | 1038.31 ms | 16.71 ms（1.64%） |
| 使用 5 个 Vant 组件 | 926.26 ms | 1186.66 ms | 260.40 ms（28.11%） |
| 使用 20 个 Vant 组件 | 898.08 ms | 1452.75 ms | 554.67 ms（61.76%） |

### C. support-files profiling（mean）

| 场景 | 模式 | tsconfig | register local | scan template | resolve tags/all | flush outputs |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 使用 1 个 Vant 组件 | current | 2.33 ms | 27.04 ms | 7.42 ms | 24.88 ms | 4.23 ms |
| 使用 1 个 Vant 组件 | legacy | 3.09 ms | 22.41 ms | - | 1.02 ms | 311.38 ms |
| 使用 5 个 Vant 组件 | current | 1.78 ms | 23.82 ms | 27.83 ms | 72.37 ms | 16.93 ms |
| 使用 5 个 Vant 组件 | legacy | 2.74 ms | 14.20 ms | - | 0.86 ms | 247.17 ms |
| 使用 20 个 Vant 组件 | current | 2.86 ms | 14.04 ms | 2.29 ms | 65.43 ms | 35.34 ms |
| 使用 20 个 Vant 组件 | legacy | 1.25 ms | 11.24 ms | - | 0.88 ms | 298.14 ms |

## 产物规模

| 场景 | disabled manifest | current manifest | legacy manifest | current typed | legacy typed | current vue | legacy vue |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 使用 1 个 Vant 组件 | 0 | 16 | 77 | 16 | 77 | 24 | 146 |
| 使用 5 个 Vant 组件 | 0 | 18 | 77 | 18 | 77 | 28 | 146 |
| 使用 20 个 Vant 组件 | 0 | 32 | 77 | 32 | 77 | 56 | 146 |

## 结论

### 1. 开不开自动导入，差多少

按当前测试口径，`autoImportComponents` 的额外成本主要体现在两层：

- support-files 同步阶段：
  - 用到很少量 Vant 组件时，额外成本大约 `61.58ms`。
  - 用到 5 个 Vant 组件时，额外成本约 `141.63ms`。
  - 用到 20 个 Vant 组件时，额外成本约 `118.78ms`。
- 完整 `build` 阶段：
  - 使用 1 个 Vant 组件时，额外成本约 `16.71ms`
  - 使用 5 个 Vant 组件时，额外成本约 `260.40ms`
  - 使用 20 个 Vant 组件时，额外成本约 `554.67ms`

也就是说，如果你的核心问题是“功能本身有没有成本”，答案是有，而且完整构建链路中的成本会随着实际命中的组件数继续上升。

### 2. 这次修复有没有价值

有，而且非常明确。

- 在只用 `1` 个 Vant 组件时，当前实现比旧行为快约 `5.12x`
- 在用 `5` 个 Vant 组件时，当前实现比旧行为快约 `1.86x`
- 在用 `20` 个 Vant 组件时，当前实现仍快约 `2.60x`

原因很直接：旧行为会把 `VantResolver` 的全部组件都带入 manifest、typed-components 和 `components.d.ts`；当前实现只处理实际命中的组件。

### 3. 还能不能继续优化

可以，但优先级已经比较清楚了。

从 profiling 看：

- 旧行为的主瓶颈非常明确，几乎都堆在 `flush outputs`
  - 这说明全量 resolver 组件进入 typed / vue 支持文件后，元数据预加载与最终写出是核心成本
- 当前实现的剩余主瓶颈主要落在 `resolve tags/all`
  - 使用 5 个组件时约 `72.37ms`
  - 使用 20 个组件时约 `65.43ms`
- 当前实现的第二梯队成本是 `flush outputs`
  - 使用 20 个组件时约 `35.34ms`
- `tsconfig sync` 基本不是问题
- 模板扫描有一定波动，但不是当前最主要瓶颈

因此，下一阶段如果还要继续提速，最值得优先挖的是：

1. 降低 `resolve()` 阶段的单组件成本
2. 减少当前模式下 `flush outputs` 的重复工作
3. 最后再考虑模板扫描缓存

## 解释边界

- `support-files benchmark` 更适合回答自动导入支持文件本身的成本。
- `full build benchmark` 更接近开发者感知到的整体编译成本。
- `full build benchmark` 仍然基于合成页面，不等于你的真实业务项目最终耗时。
- 完整 build 结果会受到机器状态、磁盘缓存和 Vite/Rolldown 波动影响，因此建议在同一台机器上重复多轮观察趋势。

## 下一步建议

如果要进一步贴近真实项目，建议继续补三类数据：

1. 在一个真实业务仓库上跑同样的 `disabled/current` 完整 build 对比。
2. 分离冷启动 build 与二次 build。
3. 如果还关心开发体验，再补 `dev` 首次启动和 HMR 场景。

## 追补：2026-04-04 重复 resolve 去重优化

本轮又做了一次更小的性能优化，目标是两件事：

1. 为 resolver 命中结果增加缓存，避免同一组件在同一 importer 下重复走 resolver 链。
2. 当 resolver 组件的 `name -> from` 没有变化时，不再重复触发 typed/html/vue/manifest 输出调度。

### support-files 串行复测

同样使用 `BENCH_ITERATIONS=3`，串行执行 benchmark 后，`current` 模式均值变成：

| 场景 | 2026-04-03 current avg | 2026-04-04 current avg | 变化 |
| --- | ---: | ---: | ---: |
| 使用 1 个 Vant 组件 | 66.05 ms | 35.33 ms | -30.72 ms（-46.51%） |
| 使用 5 个 Vant 组件 | 142.79 ms | 46.03 ms | -96.76 ms（-67.76%） |
| 使用 20 个 Vant 组件 | 120.01 ms | 108.14 ms | -11.87 ms（-9.89%） |

对应的 `resolveTemplateTagsMs` 均值也有下降：

- 使用 1 个组件：`24.88ms -> 12.70ms`
- 使用 5 个组件：`72.37ms -> 22.03ms`
- 使用 20 个组件：`65.43ms -> 54.94ms`

这说明重复 resolver 解析和重复调度，确实是 support-files 热点里值得消掉的一层成本。

### full build 串行复测

同样使用 `BENCH_ITERATIONS=3` 串行执行后，`current` 模式均值为：

| 场景 | disabled avg | current avg | 开启自动导入额外成本 |
| --- | ---: | ---: | ---: |
| 使用 1 个 Vant 组件 | 1124.74 ms | 1136.68 ms | 11.93 ms（1.06%） |
| 使用 5 个 Vant 组件 | 1026.49 ms | 1338.93 ms | 312.44 ms（30.44%） |
| 使用 20 个 Vant 组件 | 1051.57 ms | 2441.14 ms | 1389.57 ms（132.14%） |

这里没有观察到稳定的端到端正向收益，尤其是 `20` 组件场景波动仍然明显。更合理的解释是：

- 这次优化主要命中了 support-files 阶段的 resolver 热点。
- 完整 build 的主要成本已经不只在重复 `resolve()`，而更可能在支持文件输出同步与整体构建链路的叠加成本上。
- 如果继续以“用户感知编译时间”为目标推进，下一阶段应该优先检查 `flushOutputs` 的批量化/去重复策略，而不是继续深挖 resolver 命中缓存。

## 追补：2026-04-04 flush 共享准备态 + metadata 快照复用

在上一轮把重复 `resolve()` 压下去之后，热点已经集中到 `flushOutputs`。因此又做了第二轮 follow-up：

1. typed/html/vue 三类输出在同一轮 flush 中共享准备态，不再重复做：
   - `syncResolverComponentProps()`
   - `preloadResolverComponentMetadata()`
   - `collectAllComponentNames()`
2. 在共享准备态中提前构建一次组件 metadata 快照，避免 typed/html/vue 各自重复调用 `getComponentMetadata()`。

### support-files 串行复测

同样使用 `BENCH_ITERATIONS=3` 串行执行后，`current` 模式均值进一步收敛为：

| 场景 | 上一轮 current avg | 本轮 current avg | 变化 |
| --- | ---: | ---: | ---: |
| 使用 1 个 Vant 组件 | 65.59 ms | 39.66 ms | -25.93 ms（-39.53%） |
| 使用 5 个 Vant 组件 | 49.79 ms | 38.48 ms | -11.31 ms（-22.72%） |
| 使用 20 个 Vant 组件 | 385.15 ms | 84.18 ms | -300.97 ms（-78.14%） |

phase 变化更直接：

- `resolveTemplateTagsMs`
  - `1` 个组件：`0.33ms -> 0.25ms`
  - `5` 个组件：`0.26ms -> 0.22ms`
  - `20` 个组件：`1.02ms -> 0.46ms`
- `flushOutputsMs`
  - `1` 个组件：`2.50ms -> 8.55ms`
  - `5` 个组件：`18.26ms -> 7.98ms`
  - `20` 个组件：`203.57ms -> 19.48ms`

这里最关键的是 `20` 组件场景：当前实现的大头不再是 resolver，也不再是巨大的 flush 放大，而是更接近由本地组件注册与少量输出写入共同构成的常规成本。

### 当前判断

到这一步，`autoImportComponents` 当前实现已经把两类明显的重复工作都砍掉了：

- 重复 resolver 命中
- 同一轮 flush 内重复准备数据、重复抓 metadata

如果还要继续提速，优先级会进一步下沉到：

1. `registerPotentialComponents()` / 本地组件扫描注册
2. Vue 输出本身的字符串生成与写文件成本
3. 更接近真实项目的 full build / dev 冷启动链路
