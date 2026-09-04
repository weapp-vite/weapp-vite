---
'@weapp-core/constants': patch
'@wevu/compiler': major
'create-weapp-vite': patch
'weapp-vite': minor
'wevu': minor
---

让 `@wevu/compiler` 在同一次模板编译中生成并消费版本化 Binding Manifest，移除 `weapp-vite` 对生成模板和脚本的 binding 二次解析；完整编译 IR 现在包含逐 dependency 更新策略和显式作用域关系，覆盖 CSS 变量样式状态、自定义指令、组件 `v-model` 修饰符及内建 template 属性等编译器生成的 mustache，且不完整清单不会启用自动 `setData.pick`。组件脚本仅注入运行时所需的精简 manifest，开发态再附加源码位置；跨文件 JSX binding 也会保留各自的源码归属和正确重映射位置。同时让 Wevu 的 `setData` 诊断按 binding id、输出路径和源码位置归因，并继续保留现有 snapshot/diff 正确性 fallback。`ScopedSlotComponentAsset` 现在直接提供必需的 `script` 与 `bindingManifest`，并移除旧的 `classStyleBindings`、`inlineExpressions`、`templateRefs` 侧通道；编译器消费者应直接 emit 新的完整资源。
