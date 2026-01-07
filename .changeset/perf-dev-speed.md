---
"weapp-vite": patch
---

优化 dev/watch 构建性能：

- dev 默认关闭 `sourcemap`（需要时可在 `vite.config.ts` 显式开启）
- 缓存 Vue SFC 解析结果，减少热更新时重复解析
- `pathExists` 查询加入 TTL 缓存，并在文件 create/delete 时失效，提升 sidecar 样式处理效率
- dev watch 时收到文件变更事件会主动失效文件读取缓存，避免极端情况下 mtime/size 未变化导致的“变更不生效”
- 无 `baseUrl/paths` 时默认不注入 `vite-tsconfig-paths`（或可 `weapp.tsconfigPaths=false` 强制关闭）
- watch 场景下避免每次 rebuild 主动 `load` 所有入口模块（仅首次预热），减少全量重编译倾向
