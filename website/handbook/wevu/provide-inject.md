---
title: provide/inject：依赖注入
description: Wevu 当前版本没有完整的组件树父子指针，inject() 不会像 Vue 那样向上逐级查找祖先组件；需要依赖注入时建议：
keywords:
  - Wevu
  - handbook
  - provide
  - inject
  - provide/inject：依赖注入
  - 当前版本没有完整的组件树父子指针
  - 不会像
---

# provide / inject：依赖注入

## 本章你会学到什么

- Wevu 的 provide/inject 能做什么、不能做什么
- 如何在小程序限制下组织“全局能力”

## 重要限制（先读）

Wevu 当前版本没有完整的组件树父子指针，`inject()` 不会像 Vue 那样向上逐级查找祖先组件；需要依赖注入时建议：

- 组件内注入优先用于“同实例域”
- 全局共享优先用 store
- `provideGlobal/injectGlobal` 仅用于兼容旧代码，不建议作为新方案继续使用

> [!WARNING]
> `provideGlobal()` / `injectGlobal()` 属于兼容性废弃 API。新代码不要再把它们当成推荐模式。
> 如果只是局部共享，优先使用 `provide()` / `inject()`；如果是跨页面或全局共享，优先使用 store。

详细说明：`/wevu/runtime#Provide--Inject`
