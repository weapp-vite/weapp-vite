---
title: provide/inject：依赖注入
description: wevu 当前版本没有完整的组件树父子指针，inject() 不会像 Vue 那样向上逐级查找祖先组件；需要依赖注入时建议：
keywords:
  - wevu
  - handbook
  - provide
  - inject
  - provide/inject：依赖注入
  - 当前版本没有完整的组件树父子指针
  - 不会像
---

# provide / inject：依赖注入

## 本章你会学到什么

- wevu 的 provide/inject 能做什么、不能做什么
- 如何在小程序限制下组织“全局能力”

## 重要限制（先读）

wevu 当前版本没有完整的组件树父子指针，`inject()` 不会像 Vue 那样向上逐级查找祖先组件；需要依赖注入时建议：

- 组件内注入优先用于“同实例域”
- 全局共享用 `provideGlobal/injectGlobal`（或 store）

详细说明：`/wevu/runtime#Provide--Inject`
