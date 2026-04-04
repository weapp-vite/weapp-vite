---
title: "Weapp-vite: 对小程序工程化的重新思考（草稿）"
description: 这不是一篇功能罗列，而是从源码与文档出发，重新讨论小程序工程化里最关键的 5 件事：AI 协作、原子化样式、分包策略、热更新速度和语法改写。
keywords:
  - Weapp-vite
  - 小程序工程化
  - AI
  - weapp-tailwindcss
  - 分包
  - HMR
  - Vue SFC
date: 2026-03-04
---

# Weapp-vite: 对小程序工程化的重新思考

很多人聊小程序工程化，最后都会落成一份工具清单：支持了什么、兼容了什么、能跑到多少端。

但如果你真的在业务里维护过一个中大型小程序项目，你会发现真正折磨人的从来不是“有没有这个功能”，而是另外几件事：

- 团队能不能稳定协作，尤其是和 AI 协作时，输出是否可控。
- 样式体系能不能长期维护，而不是三个月后全靠搜索替换。
- 分包到底是“能配上”还是“能吃透”，包体、首开、复用有没有工程策略。
- 热更新是不是快到可以让人愿意频繁改、频繁试。
- 语法升级是不是只停留在表面，还是从编译和运行时一起重写过。

`weapp-vite` 有意思的地方在于，它不是把这些问题拆开做，而是把它们连成了一条完整链路。

## 1. AI 不是“外挂”，而是工程链路的一部分

很多项目谈 AI，停留在“可以让 AI 生成代码”。`weapp-vite` 的做法更务实：先把 AI 放进可验证的工程上下文里。

文档里已经把协作路径写得很清楚了：`Skills` 负责给 AI 固定流程，`MCP` 负责把仓库能力暴露给 AI，`llms.txt` 负责给模型稳定喂上下文（见 `/guide/ai`）。

这件事在源码里不是口号。`packages/weapp-vite/src/defaults.ts` 里，`mcp` 默认就是启用状态（`enabled: true`，`autoStart: false`）；`packages/weapp-vite/src/mcp.ts` 和 `src/cli/commands/mcp.ts` 直接提供了 `wv mcp` 的启动入口，支持 `stdio` 和 `streamable-http` 两种传输。

这意味着，AI 在这个体系里不是“另一个聊天窗口”，而是一个能真实读仓库、跑命令、走工程规则的参与者。

说白了：你不是在“让 AI 猜你的项目”，你是在“给 AI 一套可执行的项目接口”。

## 2. 原子化样式的价值，不在于 class 多酷

小程序项目一旦变大，样式问题很快会演变成组织问题。你用不用原子化样式，最后比拼的不是审美，而是迭代成本。

`weapp-vite` 本身没有重复造一个样式 DSL，而是把 `weapp-tailwindcss` 放进工程默认路径。

- 文档层面：`/integration/tailwindcss` 直接把 Tailwind 集成当作一等路径。
- 脚手架层面：`packages/create-weapp-vite/src/createProject.ts` 在创建项目时会自动补齐 `weapp-tailwindcss` 依赖版本。
- 开发体验层面：`weapp.hmr.touchAppWxss` 默认是 `auto`，当检测到安装了 `weapp-tailwindcss` 时，会在开发构建结束后 touch `app.wxss` 来触发开发者工具热重载（见 `runtime/buildPlugin/touchAppWxss.ts` 和 `runtime/buildPlugin/service.ts`）。

这组设计背后的思路很实在：

第一，样式原子化不是“可选潮流”，而是把样式治理从“文件级维护”改成“规则级维护”。
第二，工具链要主动适配这套工作流，而不是把热更新问题甩给开发者手动刷新。

## 3. 分包能力的关键，不是会分，而是怎么分

小程序都支持分包，但“支持分包”和“分包可控”是两回事。

`weapp-vite` 在这块做得比较深。文档 `/guide/subpackage` 和 `/config/shared#weapp-chunks` 讲了策略，源码 `runtime/chunkStrategy/apply.ts` 负责真正执行：

- 默认 `sharedStrategy: 'duplicate'`，把跨分包共享 chunk 复制到各分包，优先保证分包首开体验。
- 可切到 `hoist`，把共享代码提炼回主包，优先压总体体积。
- 如果共享模块同时被主包引用，策略会自动回退并保留主包版本，避免错误拆分。
- 独立分包走独立构建上下文，和主包彻底隔离。

这不是“多了几个配置项”这么简单。

它真正解决的是工程里的老问题：同一份共享代码，到底应该为“更快首开”付费，还是为“更小总包”付费。`weapp-vite` 给了明确可切换的策略，而不是只给一个黑箱结果。

## 4. 热更新快，不只是换了打包器

`v5` 切到 `rolldown-vite` 的时候，文档给了很直接的数据：示例工程里热更新平均构建时间从 `2216.58 ms` 降到 `887.56 ms`，约 `2.50` 倍提升（见 `/migration/v5`）。

但更关键的是后面的实现。

在 `plugins/hooks/useLoadEntry/index.ts` 里，HMR 不是简单“有改动就全量重编译”。默认 `sharedChunks: 'auto'` 下，会根据共享 chunk 的导入关系判断：

- 能局部更新就局部更新。
- 只有在“部分 entry 更新会导致共享 chunk 不一致”的情况下，才回退到全量 entry 发射。

再叠加 `plugins/core/lifecycle/watch.ts` 对变更入口和受影响依赖的追踪，开发态的体验就不是“快一次慢一次”，而是稳定地快。

工程上，这比“偶发峰值很低”更重要。

## 5. 语法重写：不是把 Vue 套壳到小程序上

很多人第一次看 `weapp-vite + wevu`，会以为只是“能写 `.vue` 了”。

实际情况是，编译侧和运行时都做了重新设计。

编译侧（`wevu-compiler`）里，`compileVueFile` 会经历 `parse -> template -> script -> style -> config -> finalize` 的完整阶段。模板转换不是字符串替换：

- `v-if / v-else-if / v-else` 在 `tag-structural.ts` 里做结构化转换。
- `v-for` 会解析 alias、作用域和表达式，再映射到小程序循环语义。
- `v-model` 在 `directives/model.ts` 里按不同宿主控件生成不同绑定策略。
- `<script setup>` 里的 `definePageJson / defineComponentJson / defineAppJson` 会在编译期提取、计算和合并，然后把宏语句从运行时代码里剥离（`transform/jsonMacros/*`）。

运行时（`wevu`）则把更新路径明确落在 `diff + setData`：`runtime/diff.ts` 负责快照转 plain object、差量比较和 patch 生成，目标非常明确，就是尽量降低 `setData` 体积和频率。

这也解释了为什么 Wevu 没把 `@vue/runtime-core` 的 `createRenderer` 当主线路。因为小程序的核心更新语义不是“节点操作”，而是“数据快照下发”。这部分可以看单独文章：[/wevu/why-not-runtime-core-create-renderer](/wevu/why-not-runtime-core-create-renderer)。

## 结语

如果把这套东西放在一句话里，我会这样总结：

`weapp-vite` 在做的不是“让小程序看起来像 Vue”，而是“把小程序工程化里最痛的几件事，放到同一条可验证的链路里”。

AI 协作有入口，样式体系有抓手，分包策略有取舍，热更新有稳定收益，语法升级有编译与运行时双支撑。

这才是“重新思考”的价值。不是换了写法，而是把开发、构建、调试、协作几件事重新接成了一个系统。
