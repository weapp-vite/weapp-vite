# 2026-08-09 React / Wevu runtime benchmark report

## 背景

本报告在原有 Native / Wevu 小程序运行时基准上增加 React 19，并使用同一条微信开发者工具自动化链路串行采样：

- `apps/runtime-bench-native`
- `apps/runtime-bench-vue`
- `apps/runtime-bench-react`

React 动态场景与 Native、Wevu 使用相同的卡片数据、卡片数量和更新轮次；React static binding 另设固定 host shape 的标量更新场景，不与动态卡片场景直接比较。

统一执行命令：

```bash
pnpm e2e:runtime-bench
```

## 环境与口径

- 运行日期：2026-08-09
- runtime provider：`devtools`
- Node.js：`v24.18.0`
- pnpm：`11.20.0`
- 每个场景采样 3 次，取中位数
- 每个项目使用独立 automator worker，项目内复用同一 session
- 可恢复的 `reLaunch` / session 错误会重连一次，并重跑整个失败样本
- checkpoint 按 Git commit 和 provider 隔离

构建日志中的当前 benchmark 主包体积：

| 工程 | 主包 |
| --- | ---: |
| Native | 17 KB |
| Wevu | 227 KB |
| React | 156 KB |

这些数字是 benchmark 工程的最终主包，不是框架 runtime 文件的裸大小。Wevu 工程包含 diff / patch 两个更新页；React 工程包含 dynamic / static binding 两条渲染路径，因此不能据此直接推导框架最小接入体积。

## 等价动态负载结果

### 首屏与切页

| 场景 | 指标 | Native | Wevu | React |
| --- | --- | ---: | ---: | ---: |
| 首屏 | readyMs | 9 | 9 | 43 |
| 首屏 | firstCommitMs | 0 | 2 | 7 |
| 详情切页 | readyMs | 50 | 9 | 44 |
| 详情切页 | firstCommitMs | 0 | 3 | 4 |

`wallMs` 包含 DevTools 外层 `reLaunch`、automator 和页面桥接成本，绝对值约 3.6 到 7.6 秒，不适合用于框架初始化归因。运行时判断优先看 `readyMs` 与 `firstCommitMs`。Native 详情页 `readyMs` 三次样本为 `52 / 5 / 50ms`，波动明显，因此该项不做框架排序依据。

### 100 卡片更新

| 场景 | 实现 | metricMs | computeMs | commitMs | dispatchMs | flushMs | setData |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 单次大提交 | Native | 66 | 63 | 3 | 1 | 2 | 1 |
| 单次大提交 | Wevu diff | 58 | 56 | 4 | 2 | 2 | 1 |
| 单次大提交 | Wevu patch | 71 | 67 | 4 | 2 | 2 | 1 |
| 单次大提交 | React dynamic | 75 | 55 | 19 | 17 | 2 | 1 |
| 40 次微提交 | Native | 96 | 19 | 80 | 29 | 50 | 40 |
| 40 次微提交 | Wevu diff | 97 | 16 | 84 | 7 | 77 | 40 |
| 40 次微提交 | Wevu patch | 97 | 18 | 80 | 7 | 69 | 40 |
| 40 次微提交 | React dynamic | 600 | 13 | 587 | 416 | 171 | 40 |

## React static binding

static binding 场景保持固定 WXML host shape，只更新标量 binding slot：

| 场景 | metricMs | computeMs | commitMs | dispatchMs | flushMs | setData |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 单次标量提交 | 4 | 0 | 4 | 3 | 1 | 1 |
| 40 次标量提交 | 193 | 0 | 193 | 17 | 173 | 40 |

它证明 static binding 能避免 dynamic host tree 的大部分 reconciliation / 序列化开销，但其工作负载与 100 卡片更新不同，不能用 `193ms` 与 Wevu 的 `97ms` 做同场倍率结论。

## 结论

### 1. 批量后一次提交时，React 成本可控

100 张卡片经过 180 轮纯 JS 变换后一次提交：

- Native `66ms`
- Wevu diff `58ms`
- React dynamic `75ms`

三者总耗时处于同一量级。React 的业务计算时间 `55ms` 与 Wevu `56ms` 接近，额外成本集中在 commit：React `19ms`，Wevu `4ms`。

### 2. 高频动态提交是 React 当前主要性能边界

40 次动态卡片提交：

- Native `96ms`
- Wevu diff / patch 均为 `97ms`
- React dynamic `600ms`

React 约为 Wevu 的 `6.2x`。差距不在业务计算：React `13ms`、Wevu `16-18ms`；主要来自 React dynamic 的 reconciliation / dispatch `416ms` 和底层 flush `171ms`。

### 3. Wevu 在小程序高频状态更新上更稳

当前等价负载中，Wevu 的 40 次微提交与 Native 基本持平，同时保留响应式状态与 Vue SFC 写法。对于滚动联动、连续输入、实时列表、动画驱动状态等高频更新场景，Wevu 是更稳妥的默认选择。

### 4. React 适合生态复用与可批处理页面

React 适合以下场景：

- 团队强依赖 React Hooks、Context 和既有业务组件模型
- 页面更新可以合并成少量批次
- 稳定 host shape 能命中 static binding
- 能避免在循环中逐轮强制 render / flush

React Compiler 不会消除小程序 host reconciliation 和 `setData` 提交成本，因此不能把它视为高频动态更新的根本解法。

## 基础设施修正

本轮同时修复了基准 runner 的容错边界：

- 每个样本遇到 retryable relaunch/session 错误时关闭旧 session、清理残留进程并重连一次
- 重试会从样本起点重新执行，失败尝试不进入中位数
- 每个成功 worker 立即原子写入 checkpoint
- 单个项目失败后继续执行其余项目
- `--resume` 只复用同一 commit、同一 provider 的成功结果

这避免了后续项目的 DevTools 抖动导致前面已完成的 Native / Wevu 数据全部丢失。
