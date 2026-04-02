# autoSetDataPick 性能评估报告

- 报告日期：2026-03-06（Asia/Shanghai）
- 仓库：`weapp-vite`
- 评估目标：验证 `weapp.wevu.autoSetDataPick` 相比关闭时是否有性能收益，以及可能的构建开销。

## 1. 结论摘要

1. 在“状态中存在大量模板未使用字段”的场景下，`autoSetDataPick` 有显著运行时收益。
2. 收益主要来自 **setData 前快照采集（collectSnapshot/toPlain）开销下降**，而不是 payload 本身变小。
3. 在“模板几乎使用了全部状态字段”的场景下，收益接近无差异（噪声级别）。
4. 构建侧开销极小：本次样本中位数约 `+0.30%`。

## 2. 测试环境

- Node：`v22.20.0`
- 平台：本地 macOS（仓库当前工作区）
- 运行时测试：`createApp + mount(adapter.setData)` 微基准
- 构建测试：`node packages/weapp-vite/bin/weapp-vite.js build ... --platform weapp --skipNpm`

## 3. 方法说明

### 3.1 运行时对照（核心）

- 对照组：`setData.pick` 关闭（等价 `autoSetDataPick: false`）
- 实验组：`setData.pick` 开启（等价 `autoSetDataPick` 注入结果）
- 更新模式：
  - `count`：只更新标量（`count += 1`）
  - `list`：更新列表项（`list[i].value += 1`）
- 规模维度（未使用状态体量）：
  - small：`groupCount=10, rowCount=10, mapCount=20`
  - medium：`groupCount=30, rowCount=20, mapCount=60`
  - large：`groupCount=90, rowCount=40, mapCount=120`
- 每个规模：`220 updates x 6 rounds`（warmup 后统计）
- 统计口径：中位数 `ms/update`、加速比 `baseline/pick`

### 3.2 构建对照

- 对 `e2e-apps/github-issues` 进行 `on/off` 对照构建
- 每组 `8 rounds`（warmup 后统计）
- 统计口径：build wall time 中位数

### 3.3 边界验证

额外测试“所有状态字段都被模板使用”的场景，验证此特性不是无条件提速。

## 4. 结果数据

### 4.1 运行时矩阵结果（中位数）

| 规模   |  模式 | 关闭 pick (ms/update) | 开启 pick (ms/update) |  加速比 |
| ------ | ----: | --------------------: | --------------------: | ------: |
| small  | count |               0.05693 |               0.00419 |  13.59x |
| small  |  list |               0.06376 |               0.02090 |   3.05x |
| medium | count |               0.25103 |               0.00342 |  73.31x |
| medium |  list |               0.26082 |               0.02025 |  12.88x |
| large  | count |               1.47970 |               0.00318 | 465.15x |
| large  |  list |               1.48716 |               0.02237 |  66.47x |

说明：未使用状态规模越大，`pick` 的收益越明显。

### 4.2 全字段都被使用（边界场景）

- 关闭 pick：`0.014915 ms/update`
- 开启 pick（包含全部字段）：`0.014306 ms/update`
- 比值：`1.042x`

说明：当模板覆盖几乎全部状态时，收益接近无差异。

### 4.3 构建开销结果

- `autoSetDataPick: false`：`median 845.04 ms`
- `autoSetDataPick: true`：`median 847.60 ms`
- 差值：`+2.56 ms`（`+0.30%`）

说明：编译期注入逻辑引入的构建开销在本次样本中非常小。

## 5. 机理解释（与源码行为一致）

`pick` 生效点在 wevu runtime 的快照采集阶段（`shouldIncludeKey` 过滤顶层 key）。

- 参考实现：
  - `packages-runtime/wevu/src/runtime/app/setDataOptions.ts`
  - `packages-runtime/wevu/src/runtime/app/setData/snapshot.ts`
- 影响路径：
  - `collectSnapshot` 对 state/computed 顶层键做过滤
  - 未被 pick 的大对象不会进入 `toPlain` 深转换
  - 从而减少每轮调度 CPU 开销

因此：在 payload 本身相近时，仍然会观察到明显运行时提速。

## 6. 风险与限制

1. 该评估是微基准 + 本地环境，不代表所有业务页绝对数值。
2. 大幅收益依赖“存在模板未使用的重状态”。
3. 若页面本身状态很小或模板几乎全用，收益不会显著。
4. 真实机型（中低端 Android）建议再做端侧采样验证 P50/P95。

## 7. 落地建议

1. 优先在“重状态但模板只读少量字段”的页面启用 `autoSetDataPick`。
2. 对关键页面保留回滚开关（配置层可快速关闭）。
3. 上线前对 3~5 个核心页面做端侧采样，关注：
   - 交互链路 P95 时延
   - setData 调用耗时分布
   - 页面首屏后连续操作卡顿率
4. 如果你计划全局默认开启，建议先灰度一版并输出页面级对照报表。

## 8. 原始测量摘要（关键数值）

- 运行时矩阵：
  - 时间：`2026-03-05T16:08:14.401Z`
  - 配置：`updates=220, rounds=6`
- 构建对照：
  - 时间：`2026-03-05T16:09:46.863Z`
  - 配置：`rounds=8`
