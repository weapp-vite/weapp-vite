---
title: 兼容性与注意事项
---

# 兼容性与注意事项

- **环境**：微信小程序，基础库 ≥ 3.0.0，Node 侧使用 weapp-vite 构建即可。
- **无 DOM/浏览器 API**：不要使用 `window`/`document`，改用小程序原生能力（如 `wx.request`）。
- **模板与事件**：`@tap`、`v-if`、`v-for` 等会被编译成原生 WXML；注意使用小程序组件名（`<view>`、`<button>` 等）。
- **组件注册**：遵循小程序规则，在 `<config>` 的 `usingComponents` 中声明；不要在 `<script>` 里用 ESModule `import` 组件。
- **样式**：输出为 `wxss`，`scoped` 会转换为小程序可用的选择器；仍需遵守小程序样式限制。
- **运行时体积**：压缩后约 30 KB，无外部依赖。
