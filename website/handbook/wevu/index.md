---
title: wevu：定位与选择
---

# wevu：定位与选择

## 本章你会学到什么

- wevu 在体系里负责什么、不负责什么
- 什么时候应该用 wevu，什么时候应该直接写原生

## 定位一句话

`wevu` 是小程序运行时：提供 Vue 3 风格的响应式与生命周期 hooks，并通过快照 diff 最小化 `setData`。

## 与 Vue Web 的关键差异

- 不引入 Virtual DOM，模板渲染仍由小程序负责
- 事件载荷是小程序 `detail`，不是 DOM Event
- 组件树能力受限（例如 inject 的查找策略不同）

详细对比：`/wevu/vue3-vs-wevu`

## 下一章

- 运行时细节：`/handbook/wevu/runtime`
