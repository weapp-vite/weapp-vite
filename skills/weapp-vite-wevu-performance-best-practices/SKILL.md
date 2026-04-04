---
name: weapp-vite-wevu-performance-best-practices
description: 面向使用 `weapp-vite + wevu` 的小程序项目的性能实践手册，对齐 `setData`、渲染、页面切换、资源和内存治理，并覆盖 `weapp.wevu.preset`、`autoSetDataPick`、分包加载、截图/截图对比/日志验收前的性能稳定化流程。
---

# weapp-vite-wevu-performance-best-practices

## 目的

在 `weapp-vite + wevu` 项目里做“有基线、可回归、能落地”的性能优化。

## 触发信号

- 用户反馈卡顿、掉帧、首屏慢、切换慢、白屏。
- 用户提到 `setData` 高频、payload 大、图片过大、内存告警。
- 用户要做系统性性能治理或性能回归。

## 适用边界

本 skill 聚焦性能诊断与优化执行。

以下情况不应作为主 skill：

- 主要是工程配置和构建策略。使用 `weapp-vite-best-practices`。
- 主要是 `.vue` 宏或模板兼容。使用 `weapp-vite-vue-sfc-best-practices`。
- 主要是 `wevu` 运行时语义。使用 `wevu-best-practices`。

## 快速开始

1. 先建立基线。
2. 优先看 `setData` 路径。
3. 再看渲染、切换、资源、内存。
4. 每次只改一类变量。
5. 先稳定性能，再做 screenshot / compare 验收。

## 执行流程

1. Baseline first

- 明确慢点属于：
  - `setData`
  - render
  - navigation
  - resource
  - memory

2. `setData` 路径

- 优先启用或确认：
  - `weapp.wevu.preset: 'performance'`
  - `autoSetDataPick`
- 避免高频回调里直接高频 `setData`

3. render 路径

- 非必要不监听 `onPageScroll`
- 曝光逻辑优先 `useIntersectionObserver`
- 动画优先 CSS / 平台动画

4. navigation 路径

- 控制 `onHide/onUnload` 阻塞
- 结合分包和提前请求减少切换窗口期成本

5. resource + memory 路径

- 图片按展示尺寸供图
- 内存告警时释放缓存、监听和定时器
- 页面卸载时清理副作用

6. AI 验收前的稳定化

- 若最终验收依赖：
  - `wv screenshot`
  - `wv compare`
  - `wv ide logs --open`
- 先保证帧率、路由切换和日志链路稳定，再做视觉验收

## 约束

- 不要一次性同时改构建、运行时和业务逻辑。
- 不要只看平均值，不看慢链路。
- 不要把“告警没了”当作性能达标。
- 不要在没基线时大改。

## 输出要求

应用本 skill 时，输出必须包含：

- 性能问题分类。
- 文件级最小改动建议。
- 验证命令与验收信号。
- 风险和回滚点。

## 完成检查

- 有优化前后基线。
- 高频 `setData` 已收敛。
- 滚动和曝光逻辑已从高频轮询中解耦。
- 页面切换没有明显阻塞。
- 资源和内存策略覆盖关键页面。

## 参考资料

- `references/runtime-perf-matrix.md`
- `references/tuning-recipes.md`
