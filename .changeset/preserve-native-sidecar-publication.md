---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(css): 修复 classic 连续增量更新时未变更原生组件样式被原始 sidecar 覆盖的问题。样式更新计划让每个受影响入口进入真实的 CSS 编译依赖图，避免共享主题仅刷新代表入口而丢失其他组件样式；元数据刷新保留已有脚本入口的加载归属，脚本移除最后一个 CSS 导入后继续发布剩余原生样式。
