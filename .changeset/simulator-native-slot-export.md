---
"@mpcore/simulator": patch
---

修复原生插槽投影时丢失事件监听的问题，使 attached 阶段的同步组件事件能够沿插槽承载者传播；同时让原生 `selectOwnerComponent()` 遵守 `wx://component-export` 的公开导出，保持测试桥接对原始实例的访问能力，与真实微信 DevTools 对齐。
