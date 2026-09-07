---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复状态保持热更新时，共享 TSX 等已打包依赖一变更就重启服务并清空交互状态的问题。已进入依赖图的脚本由 Rolldown 判断补丁或完整刷新，模板与样式继续同步；未被依赖图跟踪的模块仍保留完整构建回退。
