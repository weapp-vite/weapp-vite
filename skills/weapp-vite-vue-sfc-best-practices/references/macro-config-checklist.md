# Macro & Config Checklist

## JSON 配置策略

- Component SFC：优先 `defineComponentJson`
- Page / App SFC：优先 `definePageJson` / `defineAppJson`
- `<json>` 仅作历史兼容兜底

## 宏规则

- 一个 SFC 角色只保留一套 JSON 宏
- `definePageMeta` 可与 `definePageJson` 共存
- 宏调用保持顶层、单参数、无副作用

## IDE / 类型提示

- 在 `vueCompilerOptions.plugins` 中启用 `weapp-vite/volar`
- 使用 wevu 宏类型时，把 `vueCompilerOptions.lib` 设为 `wevu`
