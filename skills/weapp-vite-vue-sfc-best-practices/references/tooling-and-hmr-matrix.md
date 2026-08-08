# SFC Tooling And HMR Matrix

| 症状                 | 先查                                                               | 验证                                    |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `.vue` 类型漂移      | `.weapp-vite/tsconfig.app.json`、Volar plugin、solution references | `wv prepare` 后 package typecheck       |
| 模板绑定不存在       | `skipTemplateCodegen`、WXS 注入                                    | 编辑器模板诊断与目标构建                |
| JSON 修改未生效      | JSON-only HMR 条件                                                 | 只改 JSON 与完整 SFC 各跑一次           |
| `weapp.*` Hover 缺失 | `defineConfig` 导入来源                                            | 从 `weapp-vite/config` 导入后 typecheck |
