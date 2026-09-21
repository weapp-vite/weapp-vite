---
"wevu": major
"create-weapp-vite": patch
"weapp-vite": patch
"@weapp-vite/eslint": patch
---

以 Pinia 4.0.3 为公开用法和主要行为参照，完善 Store 初始化、Setup 自动解包、深层 patch、重置、插件和生命周期。本次为 major 破坏性变更，推荐使用 `createStore()` 创建管理器，`createPinia()` 保留为同实现的兼容别名，升级前须按 Store 迁移指南检查消费者：显式安装 Store 管理器、将外部 `store.field.value` 改为 `store.field`、直接从 Store 解构 actions，并为 Setup Store 自行实现 `$reset`。默认订阅改为异步且随注册作用域解绑；`$dispose` 保留状态，在途 action 结果回调继续执行。同步自动导入、兼容诊断、示例与迁移文档。

修正嵌套 `$patch` 在下一轮调度中重复发布直接修改通知的问题，保留普通同步 watcher 的逐次更新；Store 解包保留 `shallowRef` 与 `shallowReactive` 的引用和浅层响应式边界；插件初始化期间的同步订阅、默认异步订阅及显式 patch 通知对齐 Pinia。

Store 继续使用面向小程序的 wevu 响应式核心和 setData 调度。减少 patch 中被抑制的订阅重复遍历，默认订阅跨同一轮多个 patch 合并收集；修复显式 batch 与 patch 组合时重复发布 direct 的问题，保留普通同步 watcher 语义，并增加真实小程序中的通知、渲染与依赖收集次数回归。
