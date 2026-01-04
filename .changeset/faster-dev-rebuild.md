---
"weapp-vite": patch
---

### weapp-vite

- dev 模式默认排除 `.wevu-config`，避免临时文件触发无意义的重编译。
- 入口依赖的 `resolve()` 结果做跨次构建缓存，并在 create/delete 事件时自动失效，加快热更新耗时。
