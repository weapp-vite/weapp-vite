---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复 `wv dev -o` 启动阶段优先通过 automator 打开微信开发者工具时，在部分 DevTools 环境下每次都提示回退到普通 open 流程的问题。现在开发态首次打开会先使用官方 CLI 普通 open，再连接已打开的自动化会话；只有手动强制重开时才继续使用 automator 打开。
