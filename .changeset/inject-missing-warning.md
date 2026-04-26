---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 的 `inject()` 缺失 key 行为：未传默认值且找不到 provider 时改为输出 warning 并返回 `undefined`，避免后续 setup 代码被异常阻断，并与 Vue 3 的依赖注入语义保持一致。
