---
name: native-to-weapp-vite-wevu-migration
description: Apply a structured migration workflow from native mini-program projects to weapp-vite and wevu. Use when converting Page/Component code to Vue SFC, replacing setData-heavy state updates with ref/reactive, migrating properties/observers/triggerEvent contracts, introducing platform guards, and building migration-focused e2e validation and rollback checkpoints.
---

# native-to-weapp-vite-wevu-migration

## Overview

将原生小程序项目迁移到 `weapp-vite + wevu + Vue SFC`，目标是“行为等价优先、逐步语义升级、可回滚”。

适用任务：

- 原生 `Page/Component` 向 SFC 迁移。
- `this.data` / `setData` 重构为 `ref/reactive`。
- `properties/observers/triggerEvent` 迁移为 `defineProps/watch/defineEmits`。
- 增加 `import.meta.env.PLATFORM` 分支与多平台验证。
- 建立迁移过程中的 e2e 运行时错误拦截与回滚策略。

## Workflow

1. 锁定迁移波次

- 先明确本轮只迁移哪些页面族（例如订单、优惠券）。
- 禁止把业务重构和技术迁移放在同一批提交。

2. 建立迁移前基线

- 列出页面入口、关键交互、关键接口返回结构。
- 记录现有异常行为（如空数组崩溃、参数类型漂移）。

3. 先做机械迁移，再做语义迁移

- 机械迁移：把 `js/wxml/wxss/json` 合并为 `.vue`，流程保持等价。
- 语义迁移：替换为 `ref/reactive/computed/watch`，并清理大对象 `setData`。

4. 优先迁移组件契约

- 输入契约：`properties` -> `defineProps` + `withDefaults`。
- 输出契约：`triggerEvent` -> `defineEmits` + 类型化事件签名。
- 副作用契约：`observers` -> `watch/watchEffect`。

5. 处理原生能力访问

- 优先使用 `emit` 和响应式变量。
- 需要原生实例方法时，在 `setup(_, { instance })` 中使用 `instance`。
- 不把 `instance` 泄露到可序列化状态里。

6. 加入多平台条件分支

- 统一使用 `import.meta.env.PLATFORM` 做平台守卫。
- 避免在业务页面散落 `wx/my/tt` 分支，收敛到 platform helper。

7. 迁移验证与回滚

- 先单页冒烟，再定向 e2e，再关键链路真机回归。
- e2e 必须收集运行时错误日志，避免“页面可见但持续报错”。
- 每个页面族独立提交，保证可单独回滚。

## Guardrails

- 不要在同一波次同时进行“迁移 + 架构重写”。
- 不要把原生实例对象返回到模板状态。
- 不要跳过构建产物验证，只看 dev 环境。
- 不要先跑全量回归；迁移阶段优先高价值链路。

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
