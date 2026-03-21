---
title: provide / inject：什么时候该用，什么时候别用
description: 从小程序宿主限制出发，解释 Wevu 里的 provide / inject 能做什么、不能做什么，以及什么时候更应该改用 store。
keywords:
  - handbook
  - wevu
  - provide
  - inject
---

# provide / inject：什么时候该用，什么时候别用

很多 Vue 用户看到 `provide / inject` 会下意识把它当成“跨层传值神器”。
但在小程序和 Wevu 语境里，更稳的做法是保守使用它。

## 先说结论

对于新项目来说：

- 局部、明确的依赖共享，可以考虑 `provide / inject`
- 跨页面、全局、长期共享状态，优先用 store

## 为什么不能直接照搬 Web Vue 心智

因为 Wevu 当前并不是完整浏览器组件树语义。
如果你把它当成“任意祖先组件逐级查找”的万能方案，很容易预期过高。

## 一个适合使用的场景

例如一个页面里有一组很明确的局部子树，想共享一个只属于这棵子树的上下文：

```ts
provide('formLayout', {
  labelWidth: 160,
})
```

子组件里使用：

```ts
const formLayout = inject<{ labelWidth: number }>('formLayout')
```

这种“局部上下文”场景通常是可以接受的。

## 一个不太推荐的场景

例如你想用 `inject` 管：

- 全局用户信息
- 全局登录态
- 全局主题
- 跨多个页面的业务状态

这类需求更应该放进 store，因为：

- 生命周期边界更清晰
- 页面切换时更稳定
- 团队更容易理解

## 旧 API 的态度

如果你看到 `provideGlobal()` / `injectGlobal()` 这类兼容方案，请把它们理解成历史兼容手段，而不是新项目推荐模式。

## 一句话建议

`provide / inject` 更适合“局部上下文共享”，不适合充当全局状态管理。
