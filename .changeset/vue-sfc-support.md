---
"weapp-vite": minor
---

完整的 Vue SFC 单文件组件支持

- 模板编译：使用 Vue compiler-core 替代正则表达式解析，支持完整的 Vue 3 模板语法
- v-model 增强：支持所有输入类型（text、checkbox、radio、textarea、select、switch、slider、picker）
- 样式处理：实现 CSS 到 WXSS 的转换，支持 Scoped CSS 和 CSS Modules
- 插槽系统：支持默认插槽、具名插槽、作用域插槽和 fallback 内容
- 高级特性：支持动态组件 `<component :is>`、过渡动画 `<transition>`、KeepAlive
- 测试覆盖：新增 73 个测试用例，代码覆盖率达到 85%
