# SFC Tooling And HMR Matrix

| 症状                    | 先查                                                               | 验证                                    |
| ----------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `.vue` 类型漂移         | `.weapp-vite/tsconfig.app.json`、Volar plugin、solution references | `wv prepare` 后运行项目已有 typecheck script |
| 模板绑定不存在          | `skipTemplateCodegen`、WXS 注入                                    | 编辑器模板诊断与目标构建                |
| JSON 修改未生效         | JSON-only HMR 条件                                                 | 只改 JSON 与完整 SFC 各跑一次           |
| `weapp.*` Hover 缺失    | `defineConfig` 导入来源                                            | 从 `weapp-vite/config` 导入后 typecheck |
| 纯模板 SFC prepare 失败 | 是否把 `<template>` 文本交给 JSX parser、组件扫描结果              | `wv prepare` 后检查声明与目标构建       |
| JSX/TSX owner 冲突      | 项目是否启用 `weapp.react`、对应 runtime 是否显式安装              | 项目目标构建后验证该页面交互，不调用框架仓库测试 |
| 多平台 SFC 漂移         | `-p <platform>`、平台 project config、条件编译和原生组件依赖       | 每个目标独立 build，目标 IDE/真机验收   |

上述命令在消费项目根执行；无 build script 时可用 `pnpm exec wv build -p <platform>`。运行时问题还需在目标 IDE/真机观察状态、事件与样式；构建通过不能替代运行时验收。
