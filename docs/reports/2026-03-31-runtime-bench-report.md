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

## 二级拆分：compute vs commit

为进一步定位“Vue 为什么在多次小更新里明显更慢”，本次对 update 场景增加了二级埋点：

- `computeMs`
  - 仅统计 `mutateBenchCards(...)` 的纯 JS 变换时间
- `commitMs`
  - native：`setData(...) + waitForNativeFlush()`
  - vue：响应式 state 写入 + `nextTick()` + wevu 提交收敛

### 单次大更新二级数据

| 指标      | native | vue | 差值（vue - native） |
| --------- | -----: | --: | -------------------: |
| metricMs  |    104 |  98 |                   -6 |
| computeMs |     93 |  92 |                   -1 |
| commitMs  |      9 |   6 |                   -3 |

结论：

- 单次大更新里，两边差异基本可以忽略
- 纯计算时间几乎一致
- 提交阶段也没有明显额外成本

这和上一节的判断一致：当更新被收敛成“一次大提交”时，Vue/wevu 的额外调度成本不会被放大。

### 多次小更新二级数据

| 指标      | native | vue | 差值（vue - native） |
| --------- | -----: | --: | -------------------: |
| metricMs  |    179 | 310 |                 +131 |
| computeMs |     43 |  24 |                  -19 |
| commitMs  |    135 | 286 |                 +151 |

结论：

- Vue 慢并不是因为卡片数据变换更慢
- 相反，`computeMs` 上 Vue 还更低
- 真正放大差距的是 `commitMs`

也就是说，额外的成本几乎全部落在“每轮更新后的提交收敛”上，而不是业务计算上。

### 进一步解释

native 的每轮微提交主要是：

1. 计算下一轮 cards
2. 直接 `setData`
3. `wx.nextTick` 等待提交完成

Vue 的每轮微提交主要是：

1. 计算下一轮 cards
2. 写入响应式 state
3. 更新派生字段 `summary`
4. `nextTick()` 等待调度收敛
5. wevu 汇总依赖、生成更新 payload、再提交到底层

因此在 40 轮微提交下，Vue 比原生多出来的时间几乎全部堆积在：

- 响应式脏标记
- 调度队列与 `nextTick`
- 模板依赖重新收敛
- 更新 payload 生成与桥接提交

### 最终判断

对当前这组 benchmark 来说，Vue/wevu 的性能画像可以概括为：

- 大提交：和原生接近
- 小提交高频循环：主要输在每轮提交收敛成本

换句话说，Vue/wevu 更适合“批处理后一次提交”，不适合把很多细碎状态变更拆成很多轮 `nextTick`/提交。

### 对优化方向的修正

相比上一版报告，现在可以更明确地说：

- 优先优化“提交轮次”，比优化 `mutateBenchCards` 这类业务计算更重要
- 如果业务必须高频更新，优先把多轮响应式写入合并成更少的 flush
- 如果页面确实需要每轮都渲染，应该尽量缩小参与响应式 diff 的状态面

对于 wevu/runtime 层后续可以重点关注：

- 高频 `nextTick` 场景下的调度开销
- 多轮相邻更新的批处理策略
- 大数组 + 派生字段一起更新时的 payload 生成成本

## 三级拆分：dispatch vs flush

为继续确认“commitMs 为什么在 Vue 下明显放大”，本次再把 commit 阶段拆成两部分：

- `dispatchMs`
  - native：执行 `setData(...)` 本身的耗时
  - vue：写入响应式 state 与派生字段本身的耗时
- `flushMs`
  - native：`waitForNativeFlush()` 的等待时间
  - vue：`await nextTick()` 到 flush 完成的等待时间

### 单次大更新三级数据

| 指标       | native | vue | 差值（vue - native） |
| ---------- | -----: | --: | -------------------: |
| commitMs   |      3 |   5 |                   +2 |
| dispatchMs |      1 |   1 |                    0 |
| flushMs    |      3 |   4 |                   +1 |

结论：

- 单次大更新下，dispatch 和 flush 都几乎没有本质差异
- 这再次说明 Vue/wevu 在“大提交”场景下不会明显掉队

### 多次小更新三级数据

| 指标       | native | vue | 差值（vue - native） |
| ---------- | -----: | --: | -------------------: |
| commitMs   |    108 | 180 |                  +72 |
| dispatchMs |     39 |   4 |                  -35 |
| flushMs    |     69 | 171 |                 +102 |

结论：

- Vue 的问题不在 `dispatchMs`
- 相反，Vue 在“写入 state 本身”这一步更快
- 真正拉开差距的是 `flushMs`

也就是说，Vue 在微提交场景下的主要成本，几乎全部集中在：

- 调度排队
- `nextTick()` 等待
- 响应式依赖收敛后的提交完成阶段

### 最终归因收敛

把三层数据放在一起看，可以得到一个更明确的链路：

1. 业务计算 `mutateBenchCards` 不是瓶颈
2. 写入 state / 发起提交也不是瓶颈
3. 真正的热点在“发起之后，到 flush 完成之前”的运行时收敛阶段

对当前 benchmark 而言，Vue/wevu 在多次小更新里更慢，根因不是 JS 算得慢，也不是赋值慢，而是：

- 高频轮次下 `nextTick` flush 等待累计更高
- 每轮提交后的收敛成本无法像原生那样保持更低水平

### 对 runtime 优化的进一步建议

如果后续要继续往 wevu/runtime 层优化，优先级可以更明确：

1. 优先看高频 `nextTick` / flush 收敛链路
2. 再看多轮连续更新是否能做更激进的批处理
3. 最后才考虑业务计算本身

换句话说，下一阶段最值得做的不是继续压 `mutateBenchCards`，而是直接分析：

- flush 队列长度
- 相邻轮次是否重复收敛
- 每轮最终 payload 生成与桥接提交的累计成本

## 复现后增强与最新结果

在本报告完成后，基于同一条 benchmark 链路又做了针对性复现，并直接在 `wevu` 运行时里实现了几轮热路径优化，重点集中在 diff flush 阶段：

- `2585feb7d`
  - `perf(wevu): optimize owner snapshot refresh`
- `4f7894ec2`
  - `perf(wevu): reduce diff flush overhead`
- `c06312c00`
  - `perf(wevu): skip deep diff for replaced arrays`
- `4ab07bd12`
  - `perf(wevu): narrow tracker dependency scans`
- `b7c8bbfcc`
  - `perf(wevu): reduce toPlain serialization overhead`

其中最后一项主要针对 `toPlain` 序列化热路径，减少了高频 flush 中递归序列化时的临时对象分配与额外调用开销。

### 最新复测结果

使用相同命令重新复测：

```bash
pnpm run e2e:runtime-bench
```

本次连续两轮复测里，`apps/runtime-bench-vue` 的 `updateMicroCommit` 中位数分别约为：

| 轮次  | metricMs | commitMs | dispatchMs | flushMs |
| ----- | -------: | -------: | ---------: | ------: |
| run 1 |       62 |       43 |          3 |      40 |
| run 2 |       67 |       48 |          3 |      44 |

对应同轮 native 结果约为：

| 轮次  | metricMs | commitMs | dispatchMs | flushMs |
| ----- | -------: | -------: | ---------: | ------: |
| run 1 |       85 |       69 |         20 |      49 |
| run 2 |       94 |       75 |         21 |      53 |

### 修正后的结论

- `wevu` 在这条 benchmark 上确实存在可优化空间，而且主要集中在 flush 收敛链路
- 这些优化落地后，`updateMicroCommit` 已不再复现本报告里最初的 `vue 241ms vs native 129ms` 级别差距
- 最新两轮复测中，Vue 版本在该场景下已经反向领先于同轮 native 样本

这说明前文的“根因收敛”判断仍然成立，但结论需要更新为：

1. `wevu` 先前的主要短板确实在微提交 flush 热路径
2. 该问题不是架构性不可避免开销，而是可以通过运行时实现继续压缩
3. 在当前实现下，这条 benchmark 已不能再作为“wevu 微提交显著落后原生”的直接证据

### 当前判断

截至本次复现，`wevu` runtime 已经完成一轮有效增强：

- 大提交场景维持与原生接近
- 微提交场景的 flush 成本已明显下降
- 后续若继续优化，仍应优先关注 diff/serialize/flush 这一段链路，而不是业务计算本身
