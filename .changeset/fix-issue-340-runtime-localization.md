---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复跨分包复制共享 chunk 时的 runtime 本地化遗漏问题。当子包 A 的 chunk 因被子包 B 引用而复制到子包 B 的 `weapp-shared` 目录后，构建流程现在会继续为子包 B 发出对应的 `rolldown-runtime.js`，避免运行时出现 `module 'subpackages/user/rolldown-runtime.js' is not defined` 一类错误。
