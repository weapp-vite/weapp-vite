## App 生命周期 Hook

### `onLaunch()` {#onlaunch}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onLaunch']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-app)。

- 作用域：`App`
- 源码行为：注册到 `onLaunch`。

### `onShow()` {#onshow}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onShow']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-app)。

- 作用域：`App / Page / Component`
- 源码行为：统一注册到 `onShow`（App 与页面/组件共用函数名）。

### `onHide()` {#onhide}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onHide']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-app)。

- 作用域：`App / Page / Component`
- 源码行为：统一注册到 `onHide`。

### `onError()` {#onerror}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onError']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-app)。

- 作用域：`App / Component`
- 源码行为：注册到 `onError`。

### `onPageNotFound()` {#onpagenotfound}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onPageNotFound']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-app)。

- 作用域：`App`
- 源码行为：注册到 `onPageNotFound`。

### `onUnhandledRejection()` {#onunhandledrejection}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onUnhandledRejection']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-app)。

- 作用域：`App`
- 源码行为：注册到 `onUnhandledRejection`。

### `onThemeChange()` {#onthemechange}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onThemeChange']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-app)。

- 作用域：`App`
- 源码行为：注册到 `onThemeChange`。

### `onMemoryWarning()` {#onmemorywarning}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onMemoryWarning']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-app)。

- 作用域：`App`
- 源码行为：通过 `wx.onMemoryWarning` 注册监听，并在重复绑定时自动调用 `wx.offMemoryWarning` 清理旧监听。
- 建议：回调内优先释放大缓存、长列表临时数据与不必要的订阅/定时器。

<span id="lifecycle-examples"></span>

### 本组示例 {#example-lifecycle-app}

App hook 同样必须在同步 `setup()` 中注册。

```ts
import { createApp, onError, onLaunch, onMemoryWarning, onShow } from 'wevu'

createApp({
  setup() {
    onLaunch(options => console.log('launch', options))
    onShow(options => console.log('show', options))
    onError(error => console.error(error))
    onMemoryWarning(({ level }) => console.warn('memory', level))
  },
})
```
