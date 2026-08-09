# 2026-08-10 Solid-style JSX runtime POC report

## 目标

本 POC 评估一条不同于 React universal renderer 的 JSX 路线：保留 JSX 开发体验，但在构建期生成原生 WXML，运行时只用细粒度 signal 驱动稳定 binding，不维护或协调一棵动态 Host Tree。

它要回答两个问题：

1. Solid-style signal + 原生 WXML 是否能避开 React 高频动态提交的主要开销。
2. 这条路线是否已经成熟到值得进入 `weapp-vite` 公共配置和正式 runtime。

## 架构

```text
TSX template
  -> app-local Vite plugin
  -> Wevu JSX AST compiler
  -> native WXML

solid-js signals
  -> top-level binding effects
  -> microtask coalescing
  -> page.setData(binding payload)
```

这里复用了 `wevu/compiler` 已有的 JSX AST 到 WXML 能力，而不是再实现一套 JSX parser。构建产物仍由 Vite plugin 的 `emitFile` 写出，runtime 不直接写入最终 bundle。

运行时 `mount()` 首次把全部 binding 合并为一次 `setData`；后续多个同步 signal 变更在同一个微任务内合并。页面卸载时释放 Solid owner 和 effects。

## 验证范围

- 工程：`apps/runtime-bench-solid`
- Solid：`1.9.14`
- runtime provider：真实微信开发者工具
- Node.js：`v24.18.0`
- 每个场景采样 3 次，取中位数
- 卡片数量、数据结构、纯计算函数和更新轮次与现有 Native / Wevu / React benchmark 一致
- 主包：`15.2 KB`

构建断言确认更新页产出原生 `wx:for="{{cards}}"`、`wx:key="card.id"` 和 `{{card.summary}}`，且不包含 React dynamic renderer 的 `{{root:root}}` Host Tree 入口。

## 真实 DevTools 结果

### Solid 本轮数据

| 场景 | metricMs | computeMs | commitMs | dispatchMs | flushMs | setData |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 卡片，180 轮计算后单次提交 | 81 | 71 | 10 | 0 | 10 | 1 |
| 100 卡片，40 次微提交 | 371 | 10 | 361 | 3 | 358 | 40 |

首屏 `readyMs` 中位数为 `10ms`，详情页 `readyMs` 中位数为 `6ms`；两者 `firstCommitMs` 均为 `0ms`。外层 `wallMs` 包含 DevTools、automator 和 bridge 固定成本，不用于框架排序。

### 与现有基线的方向性比较

下表中的 Native / Wevu / React 来自 2026-08-09 同设备、同 provider、同负载报告；Solid 来自本轮。由于不是同一次完整 runner 采样，只能用于投资判断，不能作为正式倍率声明。

| 场景 | Native | Wevu diff | React dynamic | Solid signals |
| --- | ---: | ---: | ---: | ---: |
| 单次大提交 metricMs | 66 | 58 | 75 | 81 |
| 单次大提交 commitMs | 3 | 4 | 19 | 10 |
| 40 次微提交 metricMs | 96 | 97 | 600 | 371 |
| 40 次微提交 commitMs | 80 | 84 | 587 | 361 |

本轮完整四工程 runner 在 Native 的第二个详情页样本遇到 `navigateToDetail` automator bridge 失败，因此没有生成同 commit 的四方 checkpoint。随后单独执行 Solid worker 完整通过；第一次连接曾发生一次 `reLaunch` 超时，session 自动恢复后全部样本完成。这是 DevTools 自动化稳定性限制，最终报告没有把失败尝试计入样本。

## 结论

### 值得继续，但应投资在 compiler/runtime contract，而不是直接发布框架

Solid-style 路线验证了核心方向：原生 WXML 加稳定 binding 能避开 React dynamic Host Tree 的大量 reconciliation / dispatch 成本。40 次微提交从 React 基线的 `600ms` 降到 `371ms`，dispatch 从 `416ms` 降到 `3ms`。

但它还没有达到 Wevu/Native 的水平。Solid 的 40 次提交主要耗时落在宿主 flush（`358ms`），说明去掉 reconciliation 后，`setData` 次数和 payload 仍是首要边界。单次提交 `81ms` 也没有胜过 Wevu 的 `58ms`；其中大部分是共享卡片计算，Solid commit 本身为 `10ms`。

因此建议进入第二阶段、限定范围的编译器 POC，不建议现在新增 `weapp.solid` 配置、公开 runtime 包或模板。

## 产品化前必须解决

1. 编译器生成 binding manifest，明确每个 WXML 标识符对应的 accessor、路径和更新粒度，消除当前依赖 `cards` / `summary` 同名约定的隐式契约。
2. 支持事件、自定义组件、条件/列表作用域，并定义无法静态化 JSX 的诊断或 island fallback。
3. 将列表更新从顶层 `cards` 全量 payload 推进到可证明正确的路径级 patch，再测 payload bytes、序列化和宿主 flush。
4. 对齐生命周期、错误边界、资源释放和 HMR，保留静态宿主解析，不能依赖动态求值。
5. 增加真实业务页面和至少 10 次稳定采样；修复 benchmark 的导航 bridge 抖动后，再做同 commit 四方比较。

## 投资闸门

下一阶段达到以下条件后，才值得讨论正式包和公共配置：

- 100 卡片 40 次微提交稳定接近 Wevu，目标不高于 Wevu 的 `1.5x`
- 同步 signal 更新保持一次 `setData`，路径级更新不引入错误合并
- template/runtime binding 由编译器闭环校验，不再依赖人工命名约定
- 事件、组件、条件和列表具备最小可用闭环及真实 DevTools E2E
- 相比 Wevu 的新增维护成本能由 JSX 生态复用或显著运行时收益抵消

当前判断：**Go for compiler-stage POC，No-go for public productization**。
