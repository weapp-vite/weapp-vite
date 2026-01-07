---
"weapp-vite": patch
---

优化 dev/watch 构建性能：

- dev 默认关闭 `sourcemap`（需要时可在 `vite.config.ts` 显式开启）
- 缓存 Vue SFC 解析结果，减少热更新时重复解析
- `pathExists` 查询加入 TTL 缓存，并在文件 create/delete 时失效，提升 sidecar 样式处理效率
