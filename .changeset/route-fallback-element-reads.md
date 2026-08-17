---
"@weapp-vite/miniprogram-automator": patch
---

App-Service route 降级元素补齐只读能力：`offset()`/`size()`/`style()`/`attribute()` 经 `createSelectorQuery` 按原始组件作用域实时读取快照（每次读取重新查询，滚动/重渲染后仍新鲜），证据截图高亮框与可见性断言在 page-frame 协议失效的 DevTools 版本（如 2.01.2510290）上恢复可用；`text()`/`value()`/`property()`/`wxml()`、元素级查询与交互方法改为带替代建议的明确报错，不再等待失效协议超时。
