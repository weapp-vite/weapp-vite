---
"@weapp-core/constants": patch
"@wevu/compiler": minor
"wevu": minor
"weapp-vite": minor
"create-weapp-vite": patch
"@weapp-vite/web": patch
"@mpcore/simulator": patch
"@weapp-vite/i18n": patch
"@weapp-vite/react": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
---

为既有 `definePageMeta` 增加可选的 `route` 命名空间，并新增 `wevu/router/auto-routes` 纯数据入口。`route` 存在时要求唯一非空静态 `name`，可选 `meta` 必须是有限静态 JSON 对象并作为路由业务数据；省略 `route` 的页面保持未命名。该能力复用现有页面发现、分包、scope、缓存和更新链路生成稳定名称、最终路径及元信息，不新增 `definePage`，也不恢复历史 Page 注册宏。旧协议的持久化命名记录会随缓存 schema 自动失效并重新扫描，无需手动清理。

生成声明按路由名称关联并结构化拓宽 `meta`，贯穿导航、守卫、当前路由和动态记录类型，同时保留未命名页面及无生成映射项目的兼容行为。支持小程序和现有 Web 构建目标；`route.meta.title` 与 `route.meta.layout` 只是业务数据，不会改变宿主标题或页面 layout，宿主 JSON 仍由 `definePageJson` 负责，组件选项仍由 `defineOptions` 负责。

支持全局无导入 `definePageMeta`，以及从 `wevu` 导入（含别名）的宏调用，并正确处理绑定、遮蔽和支持路径中的源位置映射；不提供 `wevu/router` 宏导入。外部 SFC 脚本、alias 和包导出继续保留相对模块引用。顶层 `layout`（包括 Vue SFC 的动态 `layout.props` 值）和其他既有 `PageMeta` 字段保持原语义，不会进入 `route.meta`；模板表达式仍交给平台编译链路处理。仅修改路由元信息时同步更新原生增量产物与生成类型，并保留 JSON 元信息的自有键。

自动路由关闭时清理过期声明与缓存，并串行发布并发刷新结果，避免旧产物覆盖新版本。Web 开发模式在路由元信息或页面拓扑变化时重新加载应用入口，确保活动 Router 使用新快照；Web 扫描完成后原子发布状态，刷新期间和失败后保留完整的上一份虚拟模块。修复 Web 页面未保留原生 `options` 查询参数导致重定向后活动页面状态丢失的问题。
