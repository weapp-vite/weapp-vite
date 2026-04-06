---
"weapp-vite": patch
"create-weapp-vite": patch
---

调整 `weapp-vite dev` 的开发态热键提示输出顺序。现在启动时会先输出开发服务就绪、IDE 导入说明等提示，再显示 `按 h 查看帮助` 等交互热键信息，让终端文案顺序更符合“服务提示在前、快捷操作提示在后”的阅读习惯。
