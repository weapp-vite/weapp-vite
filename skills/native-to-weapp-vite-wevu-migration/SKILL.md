---
name: native-to-weapp-vite-wevu-migration
description: Structured migration workflow from native mini-program projects to `weapp-vite + wevu + Vue SFC`, covering phased rollout, behavior-equivalent conversion, typed props/events migration, platform guards, and migration-focused e2e validation with rollback checkpoints. Use when users ask to migrate native `Page/Component` code, replace `setData`-heavy patterns, map `properties/observers/triggerEvent`, or design safe incremental migration plans (e.g. "原生迁移到 weapp-vite", "setData 改造", "迁移回滚策略", "迁移 e2e 怎么测").
---

# native-to-weapp-vite-wevu-migration

## Purpose

将原生小程序迁移到 `weapp-vite + wevu + Vue SFC`，遵循“行为等价优先、语义逐步升级、全程可回滚”。

## Trigger Signals

- 用户要把原生 `Page/Component` 迁移到 `.vue`。
- 用户要把 `this.data/setData` 重构为响应式状态。
- 用户要迁移 `properties/observers/triggerEvent` 契约到 Vue/wevu 写法。
- 用户要做多平台守卫（`import.meta.env.PLATFORM`）并验证一致性。
- 用户要迁移阶段的 e2e 校验、日志拦截和回滚机制。

## Scope Boundary

使用本 skill 的前提是“迁移安全和落地路径”是核心问题。

以下情况不应作为主 skill：

- 只是在 weapp-vite 项目内做常规配置优化。使用 `weapp-vite-best-practices`。
- 只是在 `.vue` 里处理宏或模板兼容。使用 `weapp-vite-vue-sfc-best-practices`。
- 只是在 wevu 运行时做生命周期/store 优化。使用 `wevu-best-practices`。

## Quick Start

1. 划分迁移波次并定义回滚边界。
2. 建立迁移前基线（关键页面、关键交互、关键接口）。
3. 按“机械迁移 -> 语义迁移 -> 定向验证”推进。
4. 每个页面族独立提交，保证可单独回滚。

## Execution Protocol

1. 锁定迁移波次

- 本轮明确页面族和边界（例如订单链路、活动链路）。
- 禁止混入大规模业务重构或架构重写。

2. 建立迁移前基线

- 列出页面入口、关键交互、关键接口返回结构。
- 记录现有已知异常（例如空数组崩溃、参数漂移、边界态闪烁）。
- 固化至少一组可重复的冒烟路径。

3. 先机械迁移，再语义迁移

- 机械迁移：`js/wxml/wxss/json` -> `.vue`，保持行为等价。
- 语义迁移：`this.data/setData` -> `ref/reactive/computed/watch`，逐步降低大对象写入。
- 保证每步都有可验证输出，不跨越多个风险层级。

4. 优先迁移组件契约

- 输入契约：`properties` -> `defineProps` + `withDefaults`。
- 输出契约：`triggerEvent` -> `defineEmits` + 类型化事件签名。
- 副作用契约：`observers` -> `watch/watchEffect`。

5. 处理原生能力访问

- 默认优先 `emit` 与响应式状态流。
- 必须调用原生实例时，在 `setup(_, { instance })` 局部使用。
- 不把原生实例对象暴露到可序列化状态或跨层共享结构。

6. 引入平台守卫

- 统一使用 `import.meta.env.PLATFORM`。
- 将平台分支集中在 helper 层，避免散落在业务页面。

7. 建立迁移验证与回滚闭环

- 验证顺序：单页冒烟 -> 定向 e2e -> 关键链路回归。
- e2e 必须收集运行时错误日志，防止“页面可见但持续报错”。
- 每个页面族独立提交，具备单独回滚能力。

## Guardrails

- 不要在同一波次同时进行“迁移 + 架构重写”。
- 不要把原生实例对象返回到模板状态。
- 不要跳过构建产物验证，只看 dev 环境。
- 不要先跑全量回归；迁移阶段优先高价值链路。
- 不要跳过迁移前基线采集，否则难以证明行为等价。

## Output Contract

应用本 skill 时，输出必须包含：

- 迁移波次划分与边界说明。
- 每波次的“机械迁移 / 语义迁移 / 验证”任务清单。
- 风险点与回滚点。
- 最小验证命令与通过标准。

## Completion Checklist

- 迁移页面已改为 `.vue`，不再使用 `Page/Component` 构造器。
- 页面状态更新不依赖 `setData` 大对象写法。
- 组件事件/props 契约完成类型化（`defineProps/defineEmits`）。
- 多平台分支使用 `import.meta.env.PLATFORM`，并有至少 1 个次平台验证。
- e2e 能捕获运行时报错，并对关键链路有断言。
- 回滚点与迁移记录已写入变更说明。

## References

- `references/migration-checklist.md`
- `references/api-mapping-and-pitfalls.md`
