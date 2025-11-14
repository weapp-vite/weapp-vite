# 创建小程序（createApp）

每个小程序需在 `app.(js|ts)` 中调用 `createApp()` 创建应用实例。它是原生 `App()` 的超集：支持同步 `setup()`，并在 `onLaunch` 阶段调用；`setup()` 返回对象会合并到应用实例。

基础示例（需手动挂载）

```ts
import { createApp, onAppError, onAppHide, onAppShow } from 'wevu'

const app = createApp({
  setup() {
    const greeting = 'Hello wevu!'
    onAppShow(() => console.log('show'))
    onAppHide(() => console.log('hide'))
    onAppError(() => console.log('error'))
    return { greeting }
  }
})
// 手动挂载，才真正调用原生 App()
app.mount()
```

要点

- `setup()` 必须同步；`this` 在 `setup()` 中不可用。
- 生命周期在 `setup()` 期间以 `onXXX` 形式同步注册。
- 原生选项可与 `setup()` 并存；如命名冲突，以 `setup()` 返回为准（应避免）。
- 简洁写法：`createApp(() => ({ /* state & methods */ }))`

挂载与“多定义单挂载”

- 背景：原生 `App()` 是构造函数，同一文件多次调用会报错。
- wevu 的做法：`createApp()` 仅创建“可挂载实例”，真正注册在 `.mount()` 时发生。你可以在同一文件多次 `createApp()`，但仅对其中一个调用 `.mount()`：

```ts
const appA = createApp(() => ({ name: 'A' }))
const appB = createApp(() => ({ name: 'B' }))
// 仅挂载一个，避免触发原生多次 App() 的限制
appB.mount()
```

插件（app.use）

- wevu 的 `app` 支持 `use()` 安装插件，插件形态为函数或带有 `install(app, ...options)` 方法的对象：

```ts
const app = createApp(() => ({}))

function myPlugin(app: any, options?: any) {
  // 挂全局属性（在 methods/computed 中可通过 this.xxx 访问）
  app.config.globalProperties.$version = options?.version ?? '0.0.0'
}

app.use(myPlugin, { version: '1.2.3' })
app.mount()
```

- 多次 `use()` 相同插件会被忽略（去重）；`globalProperties` 作为方法/计算/watch 的读取后备，不会同步进小程序 `data`。

访问实例（替代 this）

- 应用场景下通常不需要直接访问实例；如确有需要，可使用 `getCurrentInstance()` 获取应用实例引用（尽量避免持久化保存该引用）。

```ts
import { createApp, getCurrentInstance } from 'wevu'

const app = createApp(() => {
  const app = getCurrentInstance()
  // app?.someField = '...'
  return {}
})
app.mount()
```
