---
title: 为什么没有使用 @vue/runtime-core 的 createRenderer 来实现
description: 解释 Wevu 为什么没有采用 @vue/runtime-core 的 createRenderer 作为主实现路径，并给出当前架构下的可行替代方案与技术判断。
keywords:
  - Wevu
  - createRenderer
  - runtime-core
  - setData
  - 小程序
  - 渲染器
---

# 为什么没有使用 @vue/runtime-core 的 createRenderer 来实现

这个问题可以拆成两层：

1. **技术上能不能做**：可以做。
2. **在 Wevu 当前目标下是否应该作为主实现**：不建议。

核心原因不是 `createRenderer` 不先进，而是它要求的“宿主能力模型”和小程序运行时的“数据驱动 + `setData`”模型并不对齐。

## 先看官方定义：createRenderer 需要什么

Vue 官方对自定义渲染器的定义很明确：`createRenderer(options)` 需要你提供一整套宿主节点操作（`patchProp`、`insert`、`remove`、`createElement`、`createText`、`parentNode`、`nextSibling` 等）。

- 官方文档：<https://vuejs.org/api/custom-renderer.html>
- 中文文档：<https://cn.vuejs.org/api/custom-renderer>

这套接口天然是“节点树增删改查”范式，适合 DOM、Canvas、Native UI 树这类可以被**命令式节点操作**驱动的宿主环境。

## Wevu 当前解决的问题是什么

Wevu 不是在做“替代浏览器 DOM 的通用渲染器”，而是在做“小程序运行时桥接”：

- 编译期（wevu/compiler + Weapp-vite）把模板编译为 WXML；
- 运行期维护响应式状态；
- 通过快照 diff 生成最小化 `setData` payload；
- 把更新下发到小程序视图层。

换句话说，Wevu 的关键优化点是：**控制 `setData` 的时机和体积**，而不是维护一棵可命令式操作的 host node 树。

## 架构不对齐的关键点

### 1) 注册模型不同：小程序以 App/Component 为中心

Wevu 的页面/组件注册直接走小程序 `App()` / `Component()`，生命周期与能力边界也围绕它们展开。

这意味着 Wevu 的“实例边界”天然是小程序实例，而不是 renderer 的“容器 + vnode root”。

### 2) 更新通道不同：setData payload，不是 host node patch

Wevu 更新链路的核心是：

`reactive/effect -> scheduler -> snapshot -> diff -> setData(payload)`

这个链路与 renderer 的 host ops 模型是两套抽象：

- renderer 关心“节点如何插入/删除/重排”
- Wevu 关心“哪些路径需要进 payload，如何控制字节大小和回退策略”

### 3) 编译契约不同：当前产物不是 render function 契约

Wevu 的 SFC/模板编译链路输出的是“小程序模板 + 运行时桥接代码”，不是交给 runtime renderer 执行的 vnode render 函数契约。

如果主架构迁移到 `createRenderer`，编译器与运行时契约需要一起重写，成本非常高。

## 为什么说“可以做，但不建议做主实现”

可以做 PoC 的原因：

- 可以人为构造一套 host node 抽象，把节点操作最终折叠成数据更新。

不建议作为主实现的原因：

- 会引入“抽象错位”：为了满足 host ops，不得不在小程序之上再模拟一层节点树；
- 可能出现“双重成本”：既有 renderer patch 成本，又要处理 `setData` 约束；
- 迁移收益不确定：Wevu 当前痛点（payload 控制、生命周期桥接、平台差异）不会因为用了 `createRenderer` 自动消失。

## 关于 “Taro 那种大 base.wxml 方案” 的结论

这类路线（一个较大的 `base.wxml` + 运行时驱动节点树）在技术上可行，Wevu 也不是绝对不能做。

但在小程序语境里，主流情况下会有下面这个工程事实：

1. 运行时需要维护额外的节点/实例映射与协调过程，计算与内存开销更高；
2. `base.wxml` 体积与通用性提高后，模板解析与初始化成本通常也会变重；
3. 最终仍要落到小程序 `setData`，因此上层抽象并不能绕开桥接成本。

因此更务实的结论是：

- **“可以做”**：是；
- **“默认性能会更好”**：通常不是；
- **“多数业务场景下，性能大概率低于当前 Wevu 的快照 diff + 最小 setData 链路”**：是更常见的结果。

## 当前策略与后续路线

当前策略：

- 主线继续保持“编译到 WXML + 运行时快照 diff + 最小 setData”的架构。

建议路线：

1. 若要验证 `createRenderer`，放在实验分支或独立实验包进行。
2. PoC 验收只看三件事：功能覆盖、更新性能、payload 体积。
3. 在未证明明显收益前，不替换现有主链路。

## 一句话总结

`createRenderer` 是优秀的“通用渲染器内核能力”；Wevu 解决的是“小程序 setData 语义下的运行时工程问题”。
在当前目标下，Wevu 选择不把 `createRenderer` 作为主实现，是一个更务实的工程取舍。
