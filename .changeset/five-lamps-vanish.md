---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复分包 npm 依赖配置在构建阶段污染 `app.json` 的问题。现在 `weapp.npm.subPackages.<root>.dependencies` 与分包 `inlineConfig` 只会保留在内部构建元数据里，不会再被写回最终产物的 `subPackages` / `subpackages` 节点，从而避免生成包含无效字段的 `app.json`；同时补充单测与构建回归断言，继续覆盖 issue #327 相关的分包 npm 输出场景。
