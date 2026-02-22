# Native -> weapp-vite / wevu Migration Checklist

## A. 迁移前

- [ ] 选定本轮页面族（仅一个业务域）。
- [ ] 明确迁移目标：行为等价、可回滚、可验证。
- [ ] 记录迁移前关键路径：入口、操作、接口、异常。
- [ ] 确认工程基线（Node/pnpm/weapp-vite/wevu 版本）。

## B. 机械迁移

- [ ] 将 `js + wxml + wxss + json` 合并到 `index.vue`。
- [ ] 使用 `definePageJson/defineComponentJson` 或 `<json>` 维护配置。
- [ ] 保持函数名和调用顺序，先不改业务语义。
- [ ] 页面可打开且主流程可走通。

## C. 语义迁移

- [ ] `this.data` -> `ref/reactive`。
- [ ] `setData` 大对象回写 -> 直接赋值响应式状态。
- [ ] `properties` -> `defineProps`（含默认值）。
- [ ] `observers` -> `watch/watchEffect`。
- [ ] `triggerEvent` -> `defineEmits` + `emit`。

## D. 原生能力与多平台

- [ ] 原生实例方法统一通过 `setup(_, { instance })` 使用。
- [ ] 平台分支统一使用 `import.meta.env.PLATFORM`。
- [ ] 避免在业务代码散落 `wx/my/tt` 分支。

## E. 验证

- [ ] 单页冒烟（正常/异常分支）。
- [ ] 构建验证（`pnpm build`）。
- [ ] 定向 e2e（关键链路）。
- [ ] e2e 已接入运行时错误采集（console/exception）。

## F. 回滚与交付

- [ ] 页面族粒度提交，具备单独回滚能力。
- [ ] 变更说明记录“迁移前后行为对照”。
- [ ] 已定义触发回滚的硬条件（崩溃率、支付失败等）。
