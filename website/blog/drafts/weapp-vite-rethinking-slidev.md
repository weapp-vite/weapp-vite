---
theme: seriph
title: "Weapp-vite: 对小程序工程化的重新思考"
description: 用于 20-30 分钟技术分享的 Slidev 稿件，聚焦 AI 协作、原子化样式、分包治理、HMR 与语法重写的工程化实践。
keywords:
  - Weapp-vite
  - Slidev
  - 小程序工程化
  - AI
  - weapp-tailwindcss
  - 分包
  - HMR
  - Vue SFC
info: |
  20-30 分钟演讲稿（Slidev 版本）
  主题：AI 协作、原子化样式、分包策略、HMR 与语法重写
class: text-center
drawings:
  persist: false
transition: slide-left
mdc: true
---

<!-- eslint-disable markdown/no-multiple-h1 -->

# Weapp-vite: 对小程序工程化的重新思考

副标题：从“功能堆叠”到“工程系统”

<div class="pt-8">
  讲者：{{你的名字}}<br>
  时间：2026-03-04
</div>

<!--
时间建议：1 分钟
开场不要先讲功能，先抛问题：为什么很多小程序项目“工具很多，但体验依然痛苦”？
-->

---

## layout: default

# 这场分享你能带走什么

- 一个可复用的工程化判断框架（5 个维度）
- Weapp-vite 的关键取舍，而不是参数清单
- 一份可落地的 30 天迁移/升级路线

<v-clicks>

- 适合对象：技术负责人、架构师、核心开发
- 假设前提：你已经做过中大型小程序项目

</v-clicks>

<!--
时间建议：1 分钟
先校准预期：不是教程，不是 API 全览，是工程复盘。
-->

---

# 目录

1. 为什么要“重新思考”
2. AI：从提示词到工程接口
3. 样式：原子化背后的组织收益
4. 分包：从“能分”到“分得对”
5. HMR：快只是起点，稳定快才是目标
6. 语法重写：编译链路 + 运行时双重设计
7. 30 天落地计划

<!--
时间建议：1 分钟
每个章节尽量抓一个关键词：可控、治理、策略、稳定、对齐、落地。
-->

---

# 问题不在“有没有功能”

很多团队已经有：

- Vue 写法
- 分包配置
- 热更新工具
- Tailwind 或其他原子化方案
- AI 编码助手

但依然会遇到：

- 协作不稳定
- 迭代速度波动
- 包体与首开相互拉扯
- 语法升级后运行时问题变多

<!--
时间建议：1 分钟
强调“单点能力齐全”不等于“工程系统成立”。
-->

---

## layout: center

# 核心观点

## 小程序工程化的关键，不是多支持一种写法

## 而是把开发、构建、调试、协作接成一条链路

<!--
时间建议：1 分钟
这一页是全场锚点，后面每一节都回到“链路”二字。
-->

---

## layout: section

# 1) AI 协作

从“会写代码”到“可控地参与工程”

<!--
时间建议：30 秒
章节切换页，控制节奏。
-->

---

# AI 协作的三层结构

```mermaid
flowchart LR
  A[Skills<br/>流程约束] --> B[MCP<br/>仓库能力暴露]
  B --> C[llms.txt<br/>上下文入口]
  C --> D[可执行协作链路]
```

- Skills：减少“看起来对，执行跑偏”
- MCP：让 AI 真正读代码、跑命令、调用工具
- llms：降低上下文遗漏和误判

<!--
时间建议：1.5 分钟
先讲架构，不讲细节命令。重点是“约束 + 能力 + 上下文”三件套。
-->

---

# 这不是文档口号，有源码落地

关键证据：

- `packages/weapp-vite/src/defaults.ts`
  - `mcp.enabled: true`
  - `mcp.autoStart: false`
- `packages/weapp-vite/src/mcp.ts`
  - 提供 `stdio` / `streamable-http`
- `packages/weapp-vite/src/cli/commands/mcp.ts`
  - 直接支持 `wv mcp`

结论：AI 不是外挂窗口，而是工程内角色。

<!--
时间建议：1 分钟
面向技术同学给“证据点”，提高说服力。
-->

---

# 团队落地建议（AI）

- 先统一 Skills 触发词和任务模板
- MCP 只开放必要能力，避免过宽权限
- 在 PR 模板里增加一条：
  - 本次变更是否可被 AI 工作流复现

<v-click>

一句话：把 AI 变成“可审计的协作者”。

</v-click>

<!--
时间建议：1 分钟
尽量给管理和流程建议，而不只讲工具。
-->

---

## layout: section

# 2) 原子化样式

不是审美选择，是治理选择

<!--
时间建议：30 秒
-->

---

# 为什么是“治理问题”

样式体系一旦规模化，痛点通常是：

- 重复样式不断增长
- 组件样式语义不统一
- 改一个设计 token 需要大量回归

原子化样式的价值：

- 让样式复用从“复制”变“组合”
- 让设计约束从“约定”变“语法”

<!--
时间建议：1 分钟
别陷入 class 名争论，站在组织效率层面讲。
-->

---

# Weapp-vite 的处理方式：集成，而不重造

- 文档入口：`website/integration/tailwindcss.md`
- 脚手架：`create-weapp-vite` 自动补齐 `weapp-tailwindcss`
  - `packages/create-weapp-vite/src/createProject.ts`
- HMR 细节：检测到 `weapp-tailwindcss` 时自动 touch `app.wxss`
  - `packages/weapp-vite/src/runtime/buildPlugin/touchAppWxss.ts`

这让“原子化写法”与“开发体验”绑定在同一条链路上。

<!--
时间建议：1.5 分钟
讲到 touchAppWxss 时强调：这是工程体验层的细节优化。
-->

---

# 样式体系的三个常见误区

1. 把原子化当作“少写 CSS”的工具
2. 没有组件级样式边界规范
3. 缺少设计 token 与业务语义的映射层

建议：

- 先定 token，再定 class 约定
- 每个业务域维护最小组件样式规范
- 将“样式变更成本”纳入迭代评估

<!--
时间建议：1 分钟
讲完误区即可，不需要展开太多实现细节。
-->

---

## layout: section

# 3) 分包策略

从“会分”到“分得对”

<!--
时间建议：30 秒
-->

---

# 分包真正的决策点

你每次都在做权衡：

- 首开速度优先？
- 总体积优先？
- 共享模块复制还是提炼？

`weapp-vite` 把这件事显式化为策略：

- `sharedStrategy: 'duplicate'`（默认）
- `sharedStrategy: 'hoist'`

<!--
时间建议：1 分钟
把“策略化”作为关键词，强调可解释性。
-->

---

# `duplicate` vs `hoist`（工程视角）

| 策略        | 更适合       | 代价                         |
| ----------- | ------------ | ---------------------------- |
| `duplicate` | 分包首开体验 | 可能增加冗余体积             |
| `hoist`     | 控制总体积   | 分包首开可能依赖主包共享模块 |

源码锚点：

- `packages/weapp-vite/src/runtime/chunkStrategy/apply.ts`
- `packages/weapp-vite/src/runtime/chunkStrategy/bundle.ts`
- `packages/weapp-vite/src/plugins/core/lifecycle/emit.ts`

<!--
时间建议：1.5 分钟
可以举一个业务例子：活动页和订单页跨域共享工具库。
-->

---

# 分包治理建议

- 开发初期优先 `duplicate`（先保证体验）
- 稳定期结合数据评估是否切 `hoist`
- 使用 `wv analyze` 定期审查跨包共享与冗余
- 设定冗余体积告警阈值（`duplicateWarningBytes`）

<v-click>

结论：分包不是“配置一次就结束”，而是持续运营。

</v-click>

<!--
时间建议：1 分钟
输出一个可执行习惯：每个版本做一次 analyze 报告。
-->

---

## layout: section

# 4) HMR

快很重要，稳定地快更重要

<!--
时间建议：30 秒
-->

---

# 为什么很多团队 HMR 体验会波动

常见现象：

- 某些改动很快，某些改动突然变慢
- 共享模块改动后偶发不一致
- “为了稳”被迫全量重建

`weapp-vite` 的思路：

- 默认 `sharedChunks: 'auto'`
- 能局部更新就局部更新
- 风险场景自动回退全量发射

<!--
时间建议：1 分钟
强调 auto 的价值在于自动判断风险，而不是永远追求最快。
-->

---

# HMR 证据与逻辑

性能参考（`website/migration/v5.md`）：

- 整体平均构建：约 `1.86x` 提升
- 热更新平均构建：约 `2.50x` 提升

关键逻辑文件：

- `packages/weapp-vite/src/plugins/hooks/useLoadEntry/index.ts`
- `packages/weapp-vite/src/plugins/core/lifecycle/watch.ts`

一句话：在正确性边界内，尽量缩小重建范围。

<!--
时间建议：1.5 分钟
数据只讲一遍，重点回到策略与实现链路。
-->

---

## layout: section

# 5) 语法重写

不是“套个 Vue 壳”，而是编译 + 运行时协同

<!--
时间建议：30 秒
-->

---

# 编译侧：完整阶段管线

`wevu-compiler` 中，`compileVueFile` 走的是完整链路：

1. `parse`
2. `template`
3. `script`
4. `style`
5. `config`
6. `finalize`

核心文件：

- `packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/index.ts`
- `packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/parse.ts`

<!--
时间建议：1 分钟
先给整体视图，再讲关键能力点。
-->

---

# 模板与宏：结构化转换

- `v-if / v-else-if / v-else`
  - `.../template/elements/tag-structural.ts`
- `v-for` alias/作用域解析
  - `.../template/elements/tag-structural.ts`
- `v-model` 宿主控件差异绑定
  - `.../template/directives/model.ts`
- `definePageJson / defineComponentJson / defineAppJson`
  - `.../transform/jsonMacros/*`

这不是字符串替换，而是语义级编译。

<!--
时间建议：1.5 分钟
强调“语义级”三个字，提升技术密度。
-->

---

# 运行时：为什么坚持 `diff + setData`

运行时关键文件：

- `packages-runtime/wevu/src/runtime/diff.ts`

关注点：

- 快照 plain 化（可序列化）
- 差量路径计算
- 最小化 `setData` payload

这与小程序运行模型是对齐的。

<!--
时间建议：1 分钟
这里要把“优化目标”说清楚：体积、频率、稳定性。
-->

---

# 为什么不是 `createRenderer` 主路线

结论不是“不能做”，而是“主线不划算”。

原因：

- `createRenderer` 假设 host 节点操作模型
- 小程序核心更新模型是 `setData(payload)`
- 抽象错位会引入额外维护与性能成本

延伸阅读：

- `website/wevu/why-not-runtime-core-create-renderer.md`

<!--
时间建议：1 分钟
避免陷入框架宗教争论，强调工程取舍。
-->

---

## layout: section

# 6) 30 天落地计划

把“理念”变成“节奏”

<!--
时间建议：30 秒
-->

---

# 第 1 周：基线盘点

- 跑一次 `wv analyze`，输出包体与共享模块图
- 盘点当前 HMR 耗时波动区间
- 梳理样式体系现状：token、组件、重复率
- 明确 AI 协作入口（Skills/MCP/llms）

交付物：当前状态基线报告。

<!--
时间建议：1 分钟
-->

---

# 第 2-3 周：小步试点

- 选 1 个业务分包试点 `duplicate/hoist` 策略
- 选 1 条页面链路试点 Vue SFC + wevu
- 选 1 个模块试点 AI 流程化协作

评估维度：

- 首开性能
- 迭代效率
- 缺陷率
- 回归成本

<!--
时间建议：1 分钟
-->

---

# 第 4 周：固化规则

- 形成团队配置基线（hmr/chunks/style）
- 把 AI 工作流写入工程文档与 PR 模板
- 制定版本节奏：每次迭代固定做一次 analyze
- 建立告警阈值：包体冗余、构建耗时、回归失败率

一句话：让工程化从“人治”变“机制”。

<!--
时间建议：1 分钟
-->

---

## layout: center

# 总结

## Weapp-vite 的价值不在“功能数量”

## 而在“系统一致性”

- AI：可控协作
- 样式：可持续治理
- 分包：可解释策略
- HMR：可预期速度
- 语法：可对齐运行模型

<!--
时间建议：1 分钟
收束全场，回到第一页的核心观点。
-->

---

## layout: center

# Q&A

感谢聆听

<div class="pt-6 text-sm opacity-70">
可选补充材料：
`website/blog/drafts/weapp-vite-rethinking-release.md`<br>
`website/blog/drafts/weapp-vite-rethinking-deep-dive.md`
</div>

<!--
时间建议：2-5 分钟
留出答疑时间，整体控制在 24-28 分钟。
-->
