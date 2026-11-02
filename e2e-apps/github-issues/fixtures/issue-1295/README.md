# Issue #1295：`defineProps` 与 `defineModel` 的 props projection

页面同时使用 `defineProps` 与 `defineModel`，验证编译器识别 Vue 编译器生成的 `_mergeModels` 后，只对真实冲突的 setup 绑定做投影。无关的 `change`、`selectA`、`selectB`、`localVisible`、`localResult` 与 `hasNext` 应保留稳定的直接 WXML 绑定。

同一会话依次检查首次渲染、原生按钮更新后的文本和布尔值，以及 `reLaunch` 后恢复初值，确保精确投影同时保留响应式更新与页面隔离。
