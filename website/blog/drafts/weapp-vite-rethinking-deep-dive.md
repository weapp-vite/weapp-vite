---
title: "Weapp-vite: 对小程序工程化的重新思考（技术深聊版）"
description: 从源码与文档出发，拆解 Weapp-vite 在 AI 协作、原子化样式、分包策略、HMR 和 Vue SFC 语法重写上的工程取舍。
keywords:
  - Weapp-vite
  - Wevu
  - 小程序工程化
  - AI
  - weapp-tailwindcss
  - subpackages
  - HMR
  - Vue SFC
date: 2026-03-04
---

# Weapp-vite: 对小程序工程化的重新思考

这篇文章不是“新特性导览”，也不是“和别家对比”。
我想回答一个更具体的问题：

一个中大型小程序项目，怎样才算工程化做对了？

我自己的判断标准有 5 条：

1. AI 能不能真正进入研发链路，而不是只在群聊里写 demo。
2. 样式体系能不能稳定扩张，而不是规模一大就失控。
3. 分包有没有明确策略，能不能按业务目标调参。
4. 热更新是否稳定地快，能否支持高频试错。
5. 语法升级是不是编译和运行时一起重构，而不只是“壳子像 Vue”。

`weapp-vite` 的价值，在于它把这 5 条放进了同一套系统。

## 1. AI 协作：从“提示词”走向“工程接口”

不少团队接入 AI 后，最大问题不是模型能力，而是输出不稳定：今天能用，明天跑偏。

`weapp-vite` 文档把协作链路拆成了三个稳定层：

- `Skills`：约束 AI 工作流程。
- `MCP`：把仓库能力暴露给 AI（读代码、跑命令、调用工具）。
- `llms.txt`：给模型可控上下文入口。

这个设计在源码层是有落地的：

- `packages/weapp-vite/src/defaults.ts`：`mcp` 默认启用（`enabled: true`，`autoStart: false`）。
- `packages/weapp-vite/src/mcp.ts`：实现服务启动与配置解析，支持 `stdio` 和 `streamable-http`。
- `packages/weapp-vite/src/cli/commands/mcp.ts`：提供 `wv mcp` 命令入口。

工程含义很直接：
你不是在“让 AI 猜你的项目结构”，而是在“把项目能力显式暴露给 AI”。

## 2. 原子化样式：核心收益是治理成本下降

原子化样式在小程序里讨论很多，但常见误区是只盯着“写法是否简洁”。
实际收益在于治理：

- 统一设计 token 和工具类，减少跨页面样式漂移。
- 把修改成本集中到规则层，而不是大量样式文件搜索替换。

`weapp-vite` 在这件事上采用“集成而不重造”的路径：

- 文档侧提供 Tailwind 集成入口（`website/integration/tailwindcss.md`）。
- 脚手架 `create-weapp-vite` 创建项目时会自动处理 `weapp-tailwindcss` 依赖（`packages/create-weapp-vite/src/createProject.ts`）。
- HMR 层提供 `touchAppWxss` 自动行为（`packages/weapp-vite/src/runtime/buildPlugin/touchAppWxss.ts` 与 `service.ts`），在检测到 `weapp-tailwindcss` 时自动触发样式热重载。

这类看似“工具细节”的设计，决定了原子化样式在团队里是“长期资产”还是“初期好用，后期负担”。

## 3. 分包策略：从“可用”走向“可调”

小程序的分包不是新概念，难点在策略：

- 你更在意分包首开速度，还是总体包体积？
- 共享模块该复制还是上提？
- 主包与分包共同引用时，怎么避免错误分发？

`weapp-vite` 在文档与实现上给了完整答案。

文档侧：

- 分包实践：`website/guide/subpackage.md`
- 配置说明：`website/config/shared.md#weapp-chunks`

实现侧：

- `packages/weapp-vite/src/runtime/chunkStrategy/apply.ts`
- `packages/weapp-vite/src/runtime/chunkStrategy/bundle.ts`
- `packages/weapp-vite/src/plugins/core/lifecycle/emit.ts`

关键策略点：

1. `sharedStrategy: 'duplicate'`（默认）
   目标是优先分包首开，跨分包共享代码复制到分包共享目录。
2. `sharedStrategy: 'hoist'`
   目标是优先控制总体体积，共享代码提炼进主包。
3. 主包共同引用回退逻辑
   当共享模块同时被主包使用时，系统可自动回退，避免拆分错误。

这让“分包优化”从经验拍脑袋，变成可解释、可调参、可验证的工程动作。

## 4. HMR：速度提升之外，重点是稳定性

从 v5 开始，`weapp-vite` 转向 `rolldown-vite`。
文档给过一组参考数据（`website/migration/v5.md`）：

- 整体平均构建时间：约 `1.86` 倍提升。
- 热更新平均构建时间：约 `2.50` 倍提升。

但 HMR 真正的含金量在实现策略，不只在基准数据。

源码链路中有两个关键点：

1. `packages/weapp-vite/src/plugins/hooks/useLoadEntry/index.ts`
   在 `sharedChunks: 'auto'` 下，系统会根据“脏 entry + 共享 chunk 导入图”判断是否需要全量发射。
2. `packages/weapp-vite/src/plugins/core/lifecycle/watch.ts`
   文件变化会回溯影响入口并标记 dirty，尽可能缩小重建范围。

结果是：
开发体验不是“偶尔很快”，而是“多数场景下稳定快，且在高风险场景下自动回退保正确性”。

## 5. 语法重写：编译链路与运行时一起重构

很多人看到 Vue SFC 支持，第一反应是“可以写 `.vue` 了”。
真正的工程难点其实在：如何让这套写法在小程序运行模型下依然成立。

### 5.1 编译侧：结构化转换，不是字符串替换

在 `wevu-compiler` 里，`compileVueFile` 走完整阶段管线：

- `parse`
- `template`
- `script`
- `style`
- `config`
- `finalize`

对应文件：

- `packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/index.ts`
- `packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/parse.ts`

模板转换关键点：

- `v-if / v-else-if / v-else`：`tag-structural.ts`
- `v-for` 作用域与别名解析：`tag-structural.ts`
- `v-model` 宿主控件差异绑定：`directives/model.ts`

### 5.2 JSON 宏：把配置前移到编译期

`<script setup>` 里的 `definePageJson / defineComponentJson / defineAppJson` 会在编译时提取并剥离运行时代码：

- `packages-runtime/wevu-compiler/src/plugins/vue/transform/jsonMacros/index.ts`
- `packages-runtime/wevu-compiler/src/plugins/vue/transform/jsonMacros/parse.ts`
- `packages-runtime/wevu-compiler/src/plugins/vue/transform/jsonMacros/rewrite.ts`

这让页面/组件配置可以写在同一份 SFC 上下文里，同时保持运行时零成本。

### 5.3 运行时：坚持 `diff + setData` 路线

运行时核心在 `packages-runtime/wevu/src/runtime/diff.ts`。
它处理的是“小程序真实约束”：

- 快照 plain 化（可序列化）。
- 路径级差量比对。
- 最小化 `setData` payload。

这也是 Wevu 不把 `createRenderer` 作为主路线的根本原因。
小程序更新语义是数据下发，不是 host 节点操作。抽象层错位，往往只会引入额外成本。

延伸阅读：`website/wevu/why-not-runtime-core-create-renderer.md`

## 结论：真正的工程化，是把孤立能力接成系统

回到文章开头的 5 个问题，`weapp-vite` 给出的并不是“单点功能集合”，而是一套互相咬合的工程体系：

- AI 有稳定入口。
- 样式有长期治理路径。
- 分包有可解释策略。
- HMR 有速度和正确性的平衡机制。
- 语法升级有编译与运行时双落地。

这也是我理解的“重新思考”：
不是改一层 API 皮肤，而是把开发、构建、调试和协作的底层关系重新组织一遍。
