---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp-vite dev` 开发态热键面板的多个可用性问题：热键监听改为更稳的终端输入数据流处理，解决 `h`、`s` 等单键在部分环境下无响应的问题；面板会避免重复输出相同内容；同时会话头中的版本号改为真实包版本，避免显示 `__VERSION__` 占位值。
