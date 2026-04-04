---
name: native-to-weapp-vite-wevu-migration
description: 面向将原生小程序迁移到 `weapp-vite + wevu + Vue SFC` 的结构化迁移工作流，覆盖分波次推进、行为等价改造、`Page/Component` 到 `.vue`、props/events 类型化、`definePageMeta`/layout、平台守卫、`.weapp-vite` 支持文件、自动路由与 AI 工作流对齐，以及迁移后的截图/日志/e2e 验证与回滚检查点。
---

# native-to-weapp-vite-wevu-migration

## 用途

把原生小程序迁移到 `weapp-vite + wevu + Vue SFC`，遵循“行为等价优先、语义逐步升级、每步可回滚”。

## 何时使用

- 用户要把原生 `Page/Component` 迁到 `.vue`。
- 用户要把 `setData` 重构为响应式状态。
- 用户要迁移 `properties/observers/triggerEvent`。
- 用户要引入 `definePageMeta` / layout / autoRoutes / 受管 TS。
- 用户要在迁移后让 AI 能稳定使用项目。

## 不适用场景

本 skill 聚焦迁移路径和风险治理。

- 普通 weapp-vite 配置问题：使用 `weapp-vite-best-practices`。
- `.vue` 宏或模板兼容：使用 `weapp-vite-vue-sfc-best-practices`。
- `wevu` 运行时写法优化：使用 `wevu-best-practices`。

## 核心流程

1. 先按页面族或组件族划分迁移波次，不要把迁移和大规模业务重构绑在一起。
2. 固化迁移前基线：页面入口、关键交互、关键接口、已知异常、至少一条冒烟路径。
3. 先做机械迁移，再做语义迁移：
   - `js/wxml/wxss/json` -> `.vue`
   - `properties` -> `defineProps`
   - `triggerEvent` -> `defineEmits`
   - `observers` -> `watch/watchEffect`
4. 再做运行时升级：
   - `this.data/setData` -> `ref/reactive/computed`
   - 页面元信息走 `definePageMeta`
   - 平台分支收敛到 `import.meta.env.PLATFORM`
5. 迁移后统一 AI/工具链约束：
   - 先读根 `AGENTS.md` 与 `node_modules/weapp-vite/dist/docs/*.md`
   - 先跑 `wv prepare`
   - 明确 `wv screenshot` / `wv compare` / `wv ide logs --open`
6. 每波次独立验证并保留回滚点；布局或视觉变化再补截图对比。

## 约束

- 不要在同一波次同时做迁移和架构重写。
- 不要把原生实例对象暴露到模板状态。
- 不要跳过 `prepare` 和 `.weapp-vite` 支持文件验证。
- 不要只看 dev 环境，不看构建产物和真实运行时。

## 输出

应用本 skill 时，输出必须包含：

- 迁移波次。
- 每波次任务清单。
- 风险点与回滚点。
- 最小验证命令。

## 完成标记

- 页面/组件已完成 `.vue` 化或明确记录留在原生的原因。
- 状态更新不依赖大对象 `setData`。
- props / events 契约类型化。
- `.weapp-vite` 支持文件和 AI 指引已对齐。
- 至少有一轮可复现验证覆盖关键链路。

## 参考资料

- `references/migration-checklist.md`
- `references/api-mapping-and-pitfalls.md`
