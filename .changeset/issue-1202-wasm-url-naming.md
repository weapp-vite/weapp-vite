---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 保留普通 WASM `?url` 的自定义资产命名规则，并校验主包初始化资源不能落入 Worker 目录。
