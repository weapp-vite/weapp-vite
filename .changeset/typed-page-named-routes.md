---
"@weapp-core/constants": patch
"@wevu/compiler": minor
"wevu": minor
"weapp-vite": minor
"create-weapp-vite": patch
"@weapp-vite/web": patch
---

新增从 `wevu/router` 导入的静态 `definePage` 页面声明宏与 `wevu/router/auto-routes` 纯数据入口，复用现有页面发现、分包、scope、缓存和更新链路生成稳定名称、最终路径及元信息。生成声明按路由名称关联并结构化拓宽 `meta`，贯穿导航、守卫、当前路由和动态记录类型，同时保留未命名页面及无生成映射项目的兼容行为。支持小程序和现有 Web 构建目标；元信息不会改变宿主页面标题。

支持外部 SFC 脚本、alias 和包导出形式的页面声明，保留相对模块引用及源位置映射。区分 TypeScript 类型空间与运行时值绑定，模板表达式保留给平台编译链路处理。仅修改元信息时同步更新原生增量产物与生成类型，并保留 JSON 元信息的自有键。

自动路由关闭时清理过期声明与缓存，并串行发布并发刷新结果，避免旧产物覆盖新版本。Web 开发模式在路由元信息或页面拓扑变化时重新加载应用入口，确保活动 Router 使用新快照；Web 扫描完成后原子发布状态，刷新期间和失败后保留完整的上一份虚拟模块。修复 Web 页面未保留原生 `options` 查询参数导致重定向后活动页面状态丢失的问题。
