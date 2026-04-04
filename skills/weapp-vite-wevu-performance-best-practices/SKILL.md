---
name: weapp-vite-wevu-performance-best-practices
description: 面向使用 `weapp-vite + wevu` 的小程序项目的性能实践手册，对齐 `setData`、渲染、页面切换、资源和内存治理，并覆盖 `weapp.wevu.preset`、`autoSetDataPick`、分包加载、截图/截图对比/日志验收前的性能稳定化流程。
---

# weapp-vite-wevu-performance-best-practices

## 用途

在 `weapp-vite + wevu` 项目里做“有基线、可回归、能落地”的性能优化。

## 何时使用

- 用户反馈卡顿、掉帧、首屏慢、切换慢、白屏。
- 用户提到 `setData` 高频、payload 大、图片过大、内存告警。
- 用户要做系统性性能治理或性能回归。

## 不适用场景

本 skill 聚焦性能诊断与优化执行。

- 工程配置和构建策略：使用 `weapp-vite-best-practices`。
- `.vue` 宏或模板兼容：使用 `weapp-vite-vue-sfc-best-practices`。
- `wevu` 运行时语义：使用 `wevu-best-practices`。

## 核心流程

1. 先建立基线，并把慢点归类到：
   - `setData`
   - render
   - navigation
   - resource
   - memory
2. `setData` 路径优先检查：
   - `weapp.wevu.preset: 'performance'`
   - `autoSetDataPick`
   - 高频回调里是否直接高频 `setData`
3. render 路径优先收敛：
   - 非必要不监听 `onPageScroll`
   - 曝光逻辑优先 `useIntersectionObserver`
   - 动画优先 CSS / 平台动画
4. navigation 路径重点看 `onHide/onUnload` 阻塞和分包/提前请求策略。
5. resource / memory 路径重点看图片尺寸、缓存释放、监听与定时器清理。
6. 若最终验收依赖 `wv screenshot`、`wv compare`、`wv ide logs --open`，先把帧率、切页和日志链路稳定下来。

## 约束

- 不要一次性同时改构建、运行时和业务逻辑。
- 不要只看平均值，不看慢链路。
- 不要把“告警没了”当作性能达标。
- 不要在没基线时大改。

## 输出

应用本 skill 时，输出必须包含：

- 性能问题分类。
- 文件级最小改动建议。
- 验证命令与验收信号。
- 风险和回滚点。

## 完成标记

- 有优化前后基线。
- 高频 `setData` 已收敛。
- 滚动和曝光逻辑已从高频轮询中解耦。
- 页面切换没有明显阻塞。
- 资源和内存策略覆盖关键页面。

## 参考资料

- `references/runtime-perf-matrix.md`
- `references/tuning-recipes.md`
