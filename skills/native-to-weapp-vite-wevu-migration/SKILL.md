---
name: native-to-weapp-vite-wevu-migration
description: 面向将原生小程序迁移到 `weapp-vite + wevu + Vue SFC` 的结构化迁移工作流，覆盖分波次推进、行为等价改造、`Page/Component` 到 `.vue`、props/events 类型化、`definePageMeta`/layout、平台守卫、`.weapp-vite` 支持文件、自动路由与 AI 工作流对齐，以及迁移后的截图/日志/e2e 验证与回滚检查点。
---

# native-to-weapp-vite-wevu-migration

## 目的

把原生小程序迁移到 `weapp-vite + wevu + Vue SFC`，遵循“行为等价优先、语义逐步升级、每步可回滚”。

## 触发信号

- 用户要把原生 `Page/Component` 迁到 `.vue`。
- 用户要把 `setData` 重构为响应式状态。
- 用户要迁移 `properties/observers/triggerEvent`。
- 用户要引入 `definePageMeta` / layout / autoRoutes / 受管 TS。
- 用户要在迁移后让 AI 能稳定使用项目。

## 适用边界

本 skill 聚焦迁移路径和风险治理。

以下情况不应作为主 skill：

- 只是普通 weapp-vite 配置问题。使用 `weapp-vite-best-practices`。
- 只是 `.vue` 宏或模板兼容。使用 `weapp-vite-vue-sfc-best-practices`。
- 只是 `wevu` 运行时写法优化。使用 `wevu-best-practices`。

## 快速开始

1. 划分迁移波次。
2. 固化迁移前基线。
3. 先机械迁移，再语义迁移。
4. 每波次都保留回滚点。
5. 迁移后同步 AI 约束、`prepare`、截图和日志链路。

## 执行流程

1. 锁定迁移边界

- 本轮只明确一个页面族或组件族。
- 不要把迁移与大规模业务重构绑在一起。

2. 建立迁移前基线

- 记录页面入口、关键交互、关键接口、已知异常。
- 固化至少一条可复现冒烟路径。
- 如果后续要做截图验收，先确认目标页面和稳定路由。

3. 机械迁移

- `js/wxml/wxss/json` -> `.vue`
- 先保持行为等价，不急于做语义升级
- 组件契约优先迁：
  - `properties` -> `defineProps`
  - `triggerEvent` -> `defineEmits`
  - `observers` -> `watch/watchEffect`

4. 语义迁移

- `this.data/setData` -> `ref/reactive/computed`
- 引入 `definePageMeta`、layout、routeRules 时保持页面壳子语义明确
- 平台分支统一收敛到 `import.meta.env.PLATFORM`

5. 工具链和 AI 对齐

- 迁移项目若已安装 `weapp-vite`，优先读：
  - 根 `AGENTS.md`
  - `node_modules/weapp-vite/dist/docs/*.md`
- 迁移完成后优先执行：
  - `weapp-vite prepare`
- 若项目后续交给 AI 维护，确保这些路径明确：
  - `截图` -> `weapp-vite screenshot`
  - `截图对比` -> `weapp-vite compare`
  - `日志` -> `weapp-vite ide logs --open`

6. 验证与回滚

- 顺序：单页冒烟 -> 定向 e2e -> 关键链路回归
- 每波次独立提交，保证可单独回滚
- 如迁移涉及布局、页面结构或视觉回归，再补截图 / compare 验收

## 约束

- 不要在同一波次同时做迁移和架构重写。
- 不要把原生实例对象暴露到模板状态。
- 不要跳过 `prepare` 和 `.weapp-vite` 支持文件验证。
- 不要只看 dev 环境，不看构建产物和真实运行时。

## 输出要求

应用本 skill 时，输出必须包含：

- 迁移波次。
- 每波次任务清单。
- 风险点与回滚点。
- 最小验证命令。

## 完成检查

- 页面/组件已完成 `.vue` 化或明确记录留在原生的原因。
- 状态更新不依赖大对象 `setData`。
- props / events 契约类型化。
- `.weapp-vite` 支持文件和 AI 指引已对齐。
- 至少有一轮可复现验证覆盖关键链路。

## 参考资料

- `references/migration-checklist.md`
- `references/api-mapping-and-pitfalls.md`
