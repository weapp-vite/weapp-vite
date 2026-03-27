---
'@mpcore/simulator': patch
---

补充 `@mpcore/simulator` 中组件作用域的选择器查询支持，使 `wx.createSelectorQuery().in(component)` 能在 headless runtime 与 browser runtime 中按组件根作用域执行节点查询。
