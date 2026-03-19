---
"weapp-vite": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

升级 `htmlparser2` 到 `^11.0.0`，同步刷新工作区锁文件与相关包的依赖解析结果，确保 `weapp-vite` 与 `@weapp-vite/web` 在后续发布时携带一致的解析器版本。由于本次发布包含 `weapp-vite`，按仓库发布约定同时补充 `create-weapp-vite` 的版本变更。
