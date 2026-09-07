---
"@mpcore/test": patch
---

修复 Testing Library 屏幕查询得到组件内部节点后无法交互的问题，按组件声明作用域定位目标，支持嵌套组件并保持页面查询隔离。
