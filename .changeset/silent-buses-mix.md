---
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复 `weapp-vite dev -o` 开发态截图热键每次都重新连接 DevTools 的问题。现在开发态会优先复用已建立的 automator 会话来执行截图，并默认生成整页长截图，减少重复连接导致的超时与卡顿；底层 `weapp-ide-cli` 截图命令也新增了复用现有 `miniProgram` 会话的能力。
