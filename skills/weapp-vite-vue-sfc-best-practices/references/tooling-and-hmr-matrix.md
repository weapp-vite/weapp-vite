# SFC Tooling And HMR Matrix

| 症状                    | 先查                                                               | 验证                                    |
| ----------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `.vue` 类型漂移         | `.weapp-vite/tsconfig.app.json`、Volar plugin、solution references | `wv prepare` 后 package typecheck       |
| 模板绑定不存在          | `skipTemplateCodegen`、WXS 注入                                    | 编辑器模板诊断与目标构建                |
| JSON 修改未生效         | JSON-only HMR 条件                                                 | 只改 JSON 与完整 SFC 各跑一次           |
| `weapp.*` Hover 缺失    | `defineConfig` 导入来源                                            | 从 `weapp-vite/config` 导入后 typecheck |
| 纯模板 SFC prepare 失败 | 是否把 `<template>` 文本交给 JSX parser、组件扫描结果              | `wv prepare` 后检查声明与目标构建       |
| JSX/TSX owner 冲突      | 项目是否启用 `weapp.react`、文件归 React 还是 Wevu compiler        | 对应 owner 的编译测试与 runtime e2e     |
| 多平台 SFC 漂移         | `-p <platform>`、平台 project config、条件编译和原生组件依赖       | 每个目标独立 build，目标 IDE/真机验收   |
