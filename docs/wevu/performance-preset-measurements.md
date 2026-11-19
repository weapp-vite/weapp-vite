# wevu performance preset：收益与体积成本实测

> 状态：**未完成**。体积成本已实测；运行时收益尚无有效样本，不发布收益结论。

## 结论摘要

- 体积成本（已实测）：普通 wevu 指定 runtime 文件 170668 bytes，performance preset 为 188063 bytes，增加 17395 bytes（约 17.0 KiB，10.2%）。
- 运行时收益（未完成）：本轮 IDE 运行时 E2E 因服务连接/登录查询超时未完成，无对应收益样本。
- 默认政策不变：在获得可复现的运行时数据前，不将 performance preset 推荐为默认开启。

## 已确认事实

- 消费版本：weapp-vite / wevu 7.4.0；pnpm 12.8.1；Node 24.18.0；M4 Max 128GB。
- 编译样本 140 个、产物更新样本 500 个通过；六组 Linux/Windows/macOS × Node 22/24 CI 通过。
- 构建/HMR 接近不代表运行时无收益，也不代表有收益。
- 体积原始数据：`reports/size/wevu-analysis.json`（提交 `ae0ba52`）。

## 待验证原因

- performance preset 面向运行时优化，其价值取决于应用规模与工作负载，不能仅按名称、构建速度或旧版本结果判断。
- 本轮缺少运行时样本，因此无法量化 setData 调用/字节、调度与 host commit、内存占用等指标。

## 预期改进与测量方案

- 明确 preset 实际启用的配置与能力，复用既有 runtime 测量工具。
- 在等价源码下比较：小字段修改、批量更新、列表替换/追加/重排。
- 同时记录：setData 调用次数与字节数、调度与 host commit 时机、内存占用、包体大小。
- 计时边界遵循 #932，不以 `nextTick` 代替可见提交。
- 关联版本与机器/宿主信息，保存原始样本。

## 适用与不适用场景

- 适用：高频 setData、批量更新、列表重排等运行时热点场景（待数据确认）。
- 不适用：包体敏感、运行时负载低、以构建速度为主要诉求的场景。

## 关联

- 采集侧：weapp-vite/benchmarks#6、weapp-vite/benchmarks#5
- 运行时语义：#932
- 证据提交：`ae0ba52baa5db501d8e202b3cec9c4a888a555ff`
