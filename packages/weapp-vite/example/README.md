# Vue 示例合集（weapp-vite）

面向 weapp-vite 的完整 Vue SFC 示例集合，全部使用标准 Vue 3 语法（不依赖 wevu 组件），覆盖模板、指令、样式、插槽和运行时特性的主要场景，便于复制到小程序页面中验证。

## 目录

- `App.vue`: 示例入口，聚合所有分块示例，并包含小程序 `config` 自定义块。
- `components/BasicsSection.vue`: 响应式状态、计算属性、事件处理、动态 `class`/`style` 绑定。
- `components/ListAndCondition.vue`: `v-if / v-else-if / v-else`、`v-show`、`v-text`、`v-for`（含 `key` 和索引）。
- `components/FormControls.vue`: 多类型 `v-model`（`input`、`textarea`、`switch`、`slider`、`picker`）。
- `components/SlotHost.vue` 与 `components/SlotPlayground.vue`: 默认/具名/作用域插槽示例，含 fallback 内容。
- `components/DynamicShowcase.vue` + `components/dynamic/ListPanel.vue` & `components/dynamic/DetailPanel.vue`: 动态组件切换、`<keep-alive>`、`<transition>`。
- `components/StyleShowcase.vue`: Scoped 样式与 CSS Modules 组合使用。
- `components/render/DirectTsComponent.ts` 与 `components/render/DirectTsxComponent.tsx`: 直接用 TS / TSX 写的 Vue 组件（render 函数 + JSX）。

## 使用方式

1. 将 `example` 目录复制或引用到实际小程序页面路径下（保持相对引用一致）。
2. 在页面入口引入 `App.vue`，其内部已按区块组织各个示例组件，可根据需要拆分或单独使用。
3. 运行 `pnpm dev` 或对应项目的构建命令，即可在微信开发者工具中查看各个用法的编译结果。

每个组件都保持自洽，可单独拷贝到现有代码中验证 weapp-vite 的 Vue 支持范围。
