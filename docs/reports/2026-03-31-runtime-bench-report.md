# 2026-03-31 runtime-bench report

## 背景

本次新增两个长期保留的运行时基准工程，均放在 `apps/` 下：

- `apps/runtime-bench-native`
- `apps/runtime-bench-vue`

目标不是比较编译速度，而是比较小程序页面交互运行时差异，重点覆盖：

- 首屏进入
- 页面切换
- 单次大批量更新
- 多次小批量更新

统一执行命令：

```bash
pnpm run e2e:runtime-bench
```

测试环境为本机微信开发者工具自动化链路，使用 `devtools` provider。结果基于 3 次采样中位数。

## 基准结果

| 场景       | 指标          | native |  vue | 差值（vue - native） |
| ---------- | ------------- | -----: | ---: | -------------------: |
| 首屏       | wallMs        |   4258 | 4304 |                  +46 |
| 首屏       | readyMs       |     12 |   20 |                   +8 |
| 首屏       | firstCommitMs |      0 |    8 |                   +8 |
| 切页       | wallMs        |    910 |  868 |                  -42 |
| 切页       | readyMs       |      8 |   20 |                  +12 |
| 切页       | firstCommitMs |      0 |   10 |                  +10 |
| 单次大更新 | wallMs        |     95 |  103 |                   +8 |
| 单次大更新 | metricMs      |     89 |   98 |                   +9 |
| 单次大更新 | setDataCalls  |      1 |    1 |                    0 |
| 多次小更新 | wallMs        |    136 |  245 |                 +109 |
| 多次小更新 | metricMs      |    129 |  241 |                 +112 |
| 多次小更新 | setDataCalls  |     40 |   40 |                    0 |

## 结论

### 1. 首屏与切页：Vue 存在固定运行时开销，但量级不大

- 首屏 `readyMs` 比原生高 `8ms`
- 切页 `readyMs` 比原生高 `12ms`
- 首次提交 `firstCommitMs` 在 Vue 下多出约 `8ms` 到 `10ms`

这说明 Vue/wevu 的额外成本主要来自页面初始化后的首次响应式提交，而不是页面数量、路由或 `setData` 次数本身。

### 2. 单次大更新：Vue 略慢，但差距可控

- 两边都只有 `1` 次 `setData`
- 原生 `89ms`
- Vue `98ms`

这里两边的提交粒度完全一致，因此差异主要不是“提交次数”，而是“生成提交内容之前”的状态计算、响应式脏标记、模板依赖收集和序列化准备成本。

### 3. 多次小更新：Vue 明显更慢

- 两边都是 `40` 次 `setData`
- 原生 `129ms`
- Vue `241ms`
- Vue 多出 `112ms`

换算后，Vue 在该场景下平均每次小提交多出约 `2.8ms`

```text
(241 - 129) / 40 ≈ 2.8ms / commit
```

这说明 Vue/wevu 在“频繁小步更新”下的调度成本会被放大。对业务来说，如果页面存在高频局部改动，应该优先压缩提交轮次，而不是只关注最终 `setData` 总次数。

## 归因分析

### 首屏 / 切页为什么 Vue 更慢

原生基准页在 `onLoad` 中直接 `setData`，然后在 `onReady` 里补一次指标计算。

Vue 基准页的路径更长：

1. `onLoad` 中写入响应式 state
2. wevu 进行响应式依赖跟踪和脏标记
3. 运行时生成本轮提交 payload
4. 再落到小程序侧 `setData`
5. `onReady` 后还要补一次指标状态更新

因此 Vue 的 `firstCommitMs` 不为 0，而原生场景接近 0。

### 单次大更新为什么差距不大

两个基准工程的单次大更新都采用“先在 JS 内完成所有卡片变换，再提交一次”的策略：

- native：`apps/runtime-bench-native/src/pages/update/index.ts`
- vue：`apps/runtime-bench-vue/src/pages/update/index.vue`

这类场景会把大量时间花在 JS 计算和一次性 payload 提交上。由于双方都只做一次提交，Vue 的额外成本被压缩到一次调度与一次响应式收敛上，因此差距只有 `9ms`。

### 多次小更新为什么差距被放大

native 微提交路径：

- 每轮 `mutateBenchCards`
- 直接 `setData`
- `await waitForNativeFlush()`

Vue 微提交路径：

- 每轮 `mutateBenchCards`
- 写入响应式 state
- 更新 summary
- `await nextTick()`
- 由 wevu 再收敛成一次底层提交

两边最终都是 `40` 次提交，但 Vue 每轮多了一层响应式调度与 `nextTick` 协调，因此差距会随提交轮次近似线性放大。

## 工程观察

### 包体量

- native 主包约 `11 KB`
- vue 主包约 `96 KB`

当前这份报告聚焦运行时，但包体差异会间接影响冷启动、脚本解析和运行时准备阶段，因此首屏上出现小幅额外成本是符合预期的。

### 数据波动

首屏 `wallMs` 的绝对值明显高于 `readyMs` / `firstCommitMs`，原因是前者包含了 DevTools automator、`reLaunch`、页面桥接等外层成本。

因此解释性能差异时应优先看：

- `readyMs`
- `firstCommitMs`
- `metricMs`

而不是只看 `wallMs`

## 对业务设计的建议

### 适合 Vue/wevu 的场景

- 首屏交互压力中等，允许固定级别初始化开销
- 页面逻辑复杂，状态组合与可维护性优先
- 更新更偏向“批处理后一次提交”

### 适合原生的场景

- 高频局部更新
- 强依赖每帧或每轮交互的极低延迟
- 页面层只需要非常直接的状态写入，不需要响应式抽象

### 针对 Vue/wevu 的优化方向

- 把多次小更新合并为更少的提交轮次
- 避免在高频循环里反复 `nextTick`
- 降低单轮需要参与 diff 的状态面
- 把摘要、派生字段和大数组更新做更明确的批处理

## 相关文件

- `apps/runtime-bench-native`
- `apps/runtime-bench-vue`
- `e2e/scripts/run-runtime-bench.ts`
- `e2e/scripts/runtime-bench.worker.ts`
- `e2e/utils/automator.ts`
