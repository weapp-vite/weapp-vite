---
"wevu": major
"create-weapp-vite": patch
"weapp-vite": patch
"@weapp-vite/eslint": patch
---

以 Pinia 4.0.3 对齐 Store 初始化、Setup 自动解包、深层 patch、重置、插件和生命周期。本次为 major 破坏性变更，推荐使用 `createStore()` 创建管理器，`createPinia()` 保留为同实现的兼容别名，升级前须按 Store 迁移指南检查消费者：显式安装 Store 管理器、将外部 `store.field.value` 改为 `store.field`、直接从 Store 解构 actions，并为 Setup Store 自行实现 `$reset`。默认订阅改为异步且随注册作用域解绑；`$dispose` 保留状态，在途 action 结果回调继续执行。同步自动导入、兼容诊断、示例与迁移文档。
