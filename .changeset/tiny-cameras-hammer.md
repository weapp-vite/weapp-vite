---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp-vite dev -o` 在打开 IDE 后开发态快捷键可能失效的问题。现在会在 `open` 流程结束后重新接管终端输入，恢复 `h` 帮助、截图等热键提示与交互能力，避免终端被第三方打开流程临时改写后无法继续响应。
