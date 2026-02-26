---
title: 性能与体验优化
description: 性能与体验优化，聚焦 handbook / performance 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - wevu
  - 性能优化
  - handbook
  - performance
  - 性能与体验优化
  - 聚焦
  - /
  - 相关场景
---

# 性能与体验优化

## 本章你会学到什么

- 小程序性能的关键瓶颈在哪里
- 在 weapp-vite + wevu 体系下的实用优化清单

## 优先级最高的优化清单

- **减少首屏包体**：分包、按需依赖、图片资源策略（`/guide/subpackage`、`/guide/image-optimize`）。
- **减少 setData 压力**：避免把大对象整块更新；把列表拆成“分页/虚拟化/分段更新”。
- **减少渲染层压力**：大列表使用分页 + 占位；避免在模板里做复杂表达式。
- **减少频繁的同步 IO**：`getStorageSync` 用在关键链路要谨慎。

## wevu 相关建议

- 把“频繁变化”的 state 切细：让快照 diff 更容易命中小路径。
- 对大列表数据做“分页追加”，避免每次替换整个数组。

## 需要真机验证的点

- iOS/Android 基础库差异
- 低端机掉帧、图片解码卡顿、长列表卡顿
