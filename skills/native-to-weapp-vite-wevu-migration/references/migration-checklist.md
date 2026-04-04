# Native -> weapp-vite / wevu Migration Checklist

## 迁移前

- [ ] 选定本轮页面族或组件族，只覆盖一个业务域。
- [ ] 明确目标：行为等价、可回滚、可验证。
- [ ] 记录关键路径：入口、操作、接口、异常。
- [ ] 确认 Node / pnpm / weapp-vite / wevu 基线版本。

## 机械迁移

- [ ] 将 `js + wxml + wxss + json` 合并到 `index.vue`。
- [ ] 使用 `defineAppJson/definePageJson/defineComponentJson` 维护配置。
- [ ] 保持函数名和调用顺序，先不改业务语义。
- [ ] 页面可打开，主流程可走通。

## 语义迁移

- [ ] `this.data` -> `ref/reactive`。
- [ ] `setData` 大对象回写 -> 直接赋值响应式状态。
- [ ] `properties` -> `defineProps`。
- [ ] `observers` -> `watch/watchEffect`。
- [ ] `triggerEvent` -> `defineEmits` + `emit`。

## 原生能力与多平台

- [ ] 原生实例方法通过 `setup(_, { instance })` 使用。
- [ ] 平台分支统一使用 `import.meta.env.PLATFORM`。
- [ ] 避免在业务代码散落 `wx/my/tt` 分支。

## 验证

- [ ] 单页冒烟覆盖正常/异常分支。
- [ ] 构建验证通过。
- [ ] 定向 e2e 覆盖关键链路。
- [ ] e2e 已接入运行时错误采集。

## 回滚与交付

- [ ] 页面族粒度提交，可单独回滚。
- [ ] 变更说明记录迁移前后行为对照。
- [ ] 已定义触发回滚的硬条件。
