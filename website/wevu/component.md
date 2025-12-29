---
title: defineComponent（组件）
---

# defineComponent（组件）

`defineComponent()` 是原生 `Component()` 的超集：在组件 `lifetimes.attached` 阶段初始化运行时并执行同步 `setup()`；`setup()` 返回对象会合并到组件实例，模板可直接使用。

## lifetimes / pageLifetimes 对应的 hooks

> 说明：wevu 的 `onXXX()` 必须在 `setup()` **同步阶段**注册；因此，发生在 `setup()` 之前的生命周期（如 `lifetimes.created`）没有对应的 wevu hook 可用，只能写原生回调。

### lifetimes（组件生命周期）

| 小程序字段           | 回调名     | 对应 wevu hook             | 说明                                    |
| -------------------- | ---------- | -------------------------- | --------------------------------------- |
| `lifetimes.created`  | `created`  | -                          | 发生在 `setup()` 之前；只能使用原生回调 |
| `lifetimes.attached` | `attached` | `setup()`                  | wevu 在此阶段 mount 并执行 `setup()`    |
| `lifetimes.ready`    | `ready`    | `onReady` / `onMounted`    | 组件就绪（内部做了重复触发去重）        |
| `lifetimes.moved`    | `moved`    | `onMoved`                  | 组件移动（例如在节点树中被移动）        |
| `lifetimes.detached` | `detached` | `onUnload` / `onUnmounted` | detached 时 teardown，并触发 `onUnload` |
| `lifetimes.error`    | `error`    | `onError`                  | 组件错误（参数透传原生回调）            |

### pageLifetimes（页面对组件的影响）

| 小程序字段             | 回调名   | 对应 wevu hook             | 说明                                 |
| ---------------------- | -------- | -------------------------- | ------------------------------------ |
| `pageLifetimes.show`   | `show`   | `onShow` / `onActivated`   | 所在页面显示                         |
| `pageLifetimes.hide`   | `hide`   | `onHide` / `onDeactivated` | 所在页面隐藏                         |
| `pageLifetimes.resize` | `resize` | `onResize`                 | 所在页面尺寸变化（参数透传原生回调） |
