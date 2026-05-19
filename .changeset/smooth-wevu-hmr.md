---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 页面热更新分类，页面模板和样式等不影响运行时脚本图的局部修改不再通过 shared chunk 扩散重发其它入口，提升 wevu 模板开发时的 HMR 响应速度。
