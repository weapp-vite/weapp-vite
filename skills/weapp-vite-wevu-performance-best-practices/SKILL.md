---
name: weapp-vite-wevu-performance-best-practices
description: Performance playbook for `weapp-vite + wevu` mini-program projects, aligned with WeChat runtime guidance (`setData`, render, navigation, resource, memory). Use this whenever users report卡顿/掉帧/白屏/页面切换慢/内存告警，或希望系统性做性能治理、压测与回归。
---

# weapp-vite-wevu-performance-best-practices

## Purpose

在 `weapp-vite + wevu` 项目中做“可测量、可回归”的性能优化，优先处理运行时瓶颈（`setData`、滚动渲染、页面切换、资源加载、内存）。

## Trigger Signals

- 用户反馈页面卡顿、滚动掉帧、交互延迟。
- 用户反馈页面切换慢、首屏慢、偶发白屏。
- 用户提到 `setData` 频繁、payload 大、调试日志告警。
- 用户提到图片导致卡顿/内存上涨。
- 用户提到 iOS 内存告警、被系统回收、闪退。
- 用户要求“做一套性能优化方案/Checklist/基线与回归机制”。

## Scope Boundary

本 skill 聚焦“性能诊断与优化执行”。

以下情况不应作为主 skill：

- 主要是工程架构/分包/构建编排问题。使用 `weapp-vite-best-practices`。
- 主要是 `.vue` 宏和模板兼容问题。使用 `weapp-vite-vue-sfc-best-practices`。
- 主要是生命周期/store/event 语义重构。使用 `wevu-best-practices`。
- 主要是原生到 wevu 的迁移方案。使用 `native-to-weapp-vite-wevu-migration`。

## Quick Start

1. 建立基线：明确慢点是 `setData`、渲染、切换、资源还是内存。
2. 先开低风险优化：`weapp.wevu.preset: 'performance'` + 针对页面启用 `autoSetDataPick`。
3. 按五类场景逐项收敛：`setData -> 渲染 -> 切换 -> 资源 -> 内存`。
4. 每次只改一类变量，并附带最小验证命令与回归信号。

## Execution Protocol

1. Baseline first

- 收集关键链路：页面切换耗时、首屏渲染耗时、滚动时长链路、内存告警出现时机。
- 区分“偶发抖动”与“稳定复现”场景，优先复现稳定问题。

2. setData path（最高优先）

- 先启用/确认 `setData` 策略：`patch`、`suspendWhenHidden`、`highFrequencyWarning`。
- 用 `autoSetDataPick` 减少模板未使用字段进入快照。
- 避免在高频回调（尤其 `onPageScroll`）里直接高频 `setData`。

3. Render path

- 非必要不监听 `onPageScroll`。
- 元素曝光与可见性逻辑优先使用 `useIntersectionObserver()`。
- 动画优先 CSS / 平台动画，不用连续 `setData` 驱动整页动画。

4. Navigation path

- 控制前页 `onHide/onUnload` 耗时逻辑，必要时延后执行。
- 对分包页面的“跳转到 onLoad 前窗口期”提前请求数据。
- 结合分包与 `lazyCodeLoading`，减少切换时注入与阻塞。

5. Resource + Memory path

- 图片按展示尺寸供图，避免大图与无节制 `widthFix/heightFix`。
- 在 `onMemoryWarning()` 回调释放缓存、监听、定时器和长生命周期对象。
- 页面/组件卸载时确保副作用清理闭环（监听、timer、长任务回调）。

6. Verify narrowly

- 每轮改动给出“预期收益 + 可观测信号 + 回滚开关”。
- 优先跑定向验证，再决定是否扩大验证范围。

## Guardrails

- 不要一次性同时改“构建策略 + 运行时策略 + 业务逻辑”。
- 不要只看平均值，至少观察慢链路（P95/P99）或最差帧表现。
- 不要把“告警消失”当作“性能已达标”的唯一依据。
- 不要在未建立基线时做大规模重构。

## Output Contract

应用本 skill 时，输出必须包含：

- 性能问题分类（setData/render/nav/resource/memory）。
- 文件级最小改动建议（按优先级）。
- 对应验证命令与验收信号。
- 风险、回滚点与后续观察项。

## Completion Checklist

- 有明确的优化前后基线对照。
- `setData` 高频路径已收敛（频率/范围/payload）。
- 滚动与曝光逻辑不依赖高频 `onPageScroll + setData` 轮询。
- 页面切换链路没有明显 `onHide/onUnload` 阻塞。
- 资源策略对图片体积和布局抖动有约束。
- 内存告警与卸载清理机制已覆盖关键页面。

## References

- `references/runtime-perf-matrix.md`
- `references/tuning-recipes.md`
