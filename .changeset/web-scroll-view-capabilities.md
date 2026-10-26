---
"@weapp-vite/web": patch
---

fix(web): 支持 scroll-view 的目标定位、四种对齐方式与偏移，修复动态目标、flex 子项布局和默认滚动条行为，并统一滚动快照、边界事件与断连后的会话清理。

scrollstart / scrollend 使用浏览器 scroll 事件与 150ms 静默窗口模拟。refresher 下拉刷新仍未实现。
