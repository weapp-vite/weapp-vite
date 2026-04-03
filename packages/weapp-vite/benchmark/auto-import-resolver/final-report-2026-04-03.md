# autoImportComponents Benchmark Final Report

日期：`2026-04-03`

脚本：[`packages/weapp-vite/scripts/benchmark-auto-import-resolver.ts`](/Users/yangqiming/Documents/GitHub/weapp-vite/.codex-tmp/fix-discussion-338-vantresolver/packages/weapp-vite/scripts/benchmark-auto-import-resolver.ts)

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
| 使用 1 个 Vant 组件 | 1.54 ms | 37.77 ms | 245.84 ms | 36.24 ms（2358.72%） | 208.07 ms（84.64%） |
| 使用 5 个 Vant 组件 | 1.13 ms | 52.73 ms | 283.00 ms | 51.60 ms（4565.27%） | 230.27 ms（81.37%） |
| 使用 20 个 Vant 组件 | 1.26 ms | 95.83 ms | 180.14 ms | 94.57 ms（7493.59%） | 84.30 ms（46.80%） |

### B. full build benchmark

| 场景 | disabled avg | current avg | 开启自动导入额外成本 |
| --- | ---: | ---: | ---: |
| 使用 1 个 Vant 组件 | 1021.61 ms | 1038.31 ms | 16.71 ms（1.64%） |
| 使用 5 个 Vant 组件 | 926.26 ms | 1186.66 ms | 260.40 ms（28.11%） |
| 使用 20 个 Vant 组件 | 898.08 ms | 1452.75 ms | 554.67 ms（61.76%） |

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
  - 用到很少量 Vant 组件时，额外成本大约几十毫秒。
  - 用到 20 个 Vant 组件时，额外成本接近 `100ms`。
- 完整 `build` 阶段：
  - 使用 1 个 Vant 组件时，额外成本约 `16.71ms`
  - 使用 5 个 Vant 组件时，额外成本约 `260.40ms`
  - 使用 20 个 Vant 组件时，额外成本约 `554.67ms`

也就是说，如果你的核心问题是“功能本身有没有成本”，答案是有，而且完整构建链路中的成本会随着实际命中的组件数继续上升。

### 2. 这次修复有没有价值

有，而且非常明确。

- 在只用 `1` 个 Vant 组件时，当前实现比旧行为快约 `6.51x`
- 在用 `5` 个 Vant 组件时，当前实现比旧行为快约 `5.37x`
- 在用 `20` 个 Vant 组件时，当前实现仍快约 `1.88x`

原因很直接：旧行为会把 `VantResolver` 的全部组件都带入 manifest、typed-components 和 `components.d.ts`；当前实现只处理实际命中的组件。

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
