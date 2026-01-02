# 创建小程序（createApp）

每个小程序需在 `app.(js|ts)` 中调用 `createApp()` 创建应用实例。它是原生 `App()` 的超集：支持同步 `setup()`，并在 `onLaunch` 阶段调用；`setup()` 返回对象会合并到应用实例。

基础示例

```ts
import { createApp, onError, onHide, onShow } from 'wevu'

createApp({
  setup() {
    const greeting = 'Hello wevu!'
    onShow(() => console.log('show'))
    onHide(() => console.log('hide'))
    onError(() => console.log('error'))
    return { greeting }
  }
})
```

要点

- `setup()` 必须同步；`this` 在 `setup()` 中不可用。
- 生命周期在 `setup()` 期间以 `onXXX` 形式同步注册。
- 原生选项可与 `setup()` 并存；如命名冲突，以 `setup()` 返回为准（应避免）。
- 简洁写法：`createApp(() => ({ /* state & methods */ }))`

注册与调用

- `createApp()` 执行时会立即调用原生 `App()` 完成注册。
- 为避免触发原生“重复 App()`”限制，请确保同一小程序仅调用一次 `createApp()`。如需条件注册，请自行控制调用时机而非重复执行。

插件（app.use）

- wevu 的 `app` 支持 `use()` 安装插件，插件形态为函数或带有 `install(app, ...options)` 方法的对象：

```ts
const app = createApp(() => ({}))

function myPlugin(app: any, options?: any) {
  // 挂全局属性（在 methods/computed 中可通过 this.xxx 访问）
  app.config.globalProperties.$version = options?.version ?? '0.0.0'
}

app.use(myPlugin, { version: '1.2.3' })
```

- 多次 `use()` 相同插件会被忽略（去重）；`globalProperties` 作为方法/计算/watch 的读取后备，不会同步进小程序 `data`。

访问实例（替代 this）

- 应用场景下通常不需要直接访问实例；如确有需要，可使用 `getCurrentInstance()` 获取应用实例引用（尽量避免持久化保存该引用）。

```ts
import { createApp, getCurrentInstance } from 'wevu'

createApp(() => {
  const app = getCurrentInstance()
  // app?.someField = '...'
  return {}
})
```
