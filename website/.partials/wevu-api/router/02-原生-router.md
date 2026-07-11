## 原生 Router

### `useNativeRouter()` {#usenativerouter}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu/router')['useNativeRouter']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**示例：** 见 [本组示例](/wevu/api/router#example-router-native)。

获取当前组件路径语义的原生 Router，直接暴露小程序导航能力。

### `useNativePageRouter()` {#usenativepagerouter}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu/router')['useNativePageRouter']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**示例：** 见 [本组示例](/wevu/api/router#example-router-native)。

获取当前页面路径语义的原生 Router，适合页面级相对导航。

### 本组示例 {#example-router-native}

原生 Router 适合直接调用宿主能力；高层业务导航优先使用 `wevu/router`。

```ts
import { useNativePageRouter, useNativeRouter } from 'wevu/router'

const componentRouter = useNativeRouter()
const pageRouter = useNativePageRouter()

componentRouter.navigateTo({ url: '../detail/index?id=42' })
pageRouter.redirectTo({ url: '/pages/home/index' })
```
