---
"weapp-vite": patch
"weapp-ide-cli": patch
"@weapp-vite/devtools-runtime": patch
"create-weapp-vite": patch
---

修复 `weapp-vite dev -o` 通过 automator 打开带 `miniprogramRoot` 项目时可能切到临时哈希目录的问题。开发模式现在直接打开真实项目目录，开发态 `s` 截图热键也会保留真实项目根，避免微信开发者工具监听临时拷贝导致后续热更新失效。
