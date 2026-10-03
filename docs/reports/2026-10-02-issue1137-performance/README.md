# #1137 performance 预设实测

本报告使用同一份 `apps/runtime-bench-vue` 源码，分别以默认配置和
`weapp.wevu.preset: 'performance'` 构建，再由 headless runtime 执行相同的
首屏、切页、单次批量更新和 40 次连续更新。`update/index.vue` 不再显式指定
`setData.strategy`，因此普通构建走默认 `diff`，performance 构建走预设的
`patch`；`update-patch` 页面保留显式 `patch` 作为对照。

原始 headless 结果保存在 `runtime-normal.json` 和 `runtime-performance.json`。
它们记录每次采样和中位数，包括 wall、ready、first commit、compute、dispatch、
flush、commit、setData 调用次数、策略命中与 payload key。计时边界使用页面返回
的 commit/flush 指标，未将 `nextTick` 解释为宿主可见完成。

## headless 结果

| 场景 | 普通默认 | performance | 变化 |
| --- | ---: | ---: | ---: |
| 首屏 ready（中位数） | 74 ms | 55 ms | -19 ms |
| 切页 ready（中位数） | 60 ms | 58 ms | -2 ms |
| 单次更新 commit | 16 ms | 25 ms | +9 ms |
| 单次更新 setData | 1 | 1 | 0 |
| 40 次更新 commit | 665 ms | 720 ms | +55 ms |
| 40 次更新 setData | 40 | 40 | 0 |

本轮 headless 样本显示，列表工作负载下 performance 的 patch 路径没有收益，
反而增加了提交耗时；这不是发布到所有宿主的性能结论。首屏和切页样本波动较大，
应结合同宿主重复采样，不据此调整默认策略。

## 体积与内存

当前消费者构建输出的未压缩字节数记录在 `size.json`：普通配置
214256 bytes，performance 配置 219032 bytes，增加 4776 bytes（约 2.23%）。
外部发布包的 runtime 体积基线仍采用 benchmarks 提交
`ae0ba52baa5db501d8e202b3cec9c4a888a555ff` 的原始数据：普通 170668 bytes，
performance 188063 bytes，增加 17395 bytes（约 10.2%）。两组数据口径不同，
不能相加或互相替代。

`node-observation.json` 是发布包 runtime 适配器的补充样本，包含 prepare、
dispatch、commit、payload 字节和 `process.memoryUsage()` 前后值。它用于解释
观测开销和内存分配趋势；heap 差值不是泄漏证明，也不能替代真实宿主的内存统计。

本轮没有可用的官方稳定版微信开发者工具登录/连接证据，因此没有把 headless
数据写成 DevTools 通过，也没有据此关闭 #1137。完成该 issue 仍需在同一官方
Stable 宿主上运行等价发布包消费者，并补齐宿主可见提交、实际 payload 字节和
内存证据。
