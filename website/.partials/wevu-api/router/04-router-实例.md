## Router 实例

### `router.nativeRouter` {#router-nativerouter}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['nativeRouter']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 这是宿主 `SetupContextRouter`，不是 Vue Router 的 history 对象；方法最终受页面栈和 tabBar 约束。

**示例：** 见 [本组示例](/wevu/api/router#example-router-instance)。

Router 内部使用的原生 `SetupContextRouter`。

### `router.options` {#router-options}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['options']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 这是创建时的 Wevu 配置快照，不包含 Web history 实现。

**示例：** 见 [本组示例](/wevu/api/router#example-router-instance)。

创建 Router 时使用的只读、规范化选项快照。

### `router.currentRoute` {#router-currentroute}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['currentRoute']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 该值是 readonly 响应式路由对象本身，不是 `Ref`；读取时不要写 `.value`。它由小程序生命周期和导航完成事件同步，不监听浏览器 URL。

**示例：** 见 [本组示例](/wevu/api/router#example-router-instance)。

当前只读路由位置，包含 path、query、params、matched 和 redirectedFrom 等信息。

### `router.install()` {#router-install}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['install']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** Vue Router 安装组件与全局属性；Wevu 只注册默认 Router，并在宿主对象支持时写入 `$router`。

**示例：** 见 [本组示例](/wevu/api/router#example-router-instance)。

注册当前 Router，并在 App 支持 `globalProperties` 时写入 `$router`。

### `router.resolve()` {#router-resolve}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['resolve']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 小程序没有初始 Web history 导航，`isReady()` 在 Router 创建后立即完成；它不能用来等待页面组件挂载或宿主跳转结束。

**示例：** 见 [本组示例](/wevu/api/router#example-router-instance)。

基于当前路由和 Router 配置解析目标位置，不执行实际跳转。

### `router.isReady()` {#router-isready}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['isReady']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 调用形式接近 Vue Router，但导航最终映射到 `navigateTo`、`redirectTo`、`switchTab`、`reLaunch` 或 `navigateBack`，受页面栈和 tabBar 约束。

**示例：** 见 [本组示例](/wevu/api/router#example-router-instance)。

返回 Router 就绪 Promise；当前小程序实现创建后即可就绪。

### 本组示例 {#example-router-instance}

先 `resolve()` 检查目标，再根据当前页面栈决定是否执行导航。

```ts
import { useRouter } from 'wevu/router'

const router = useRouter()
await router.isReady()

const target = router.resolve({ name: 'detail', params: { id: 42 } })
console.log(router.options, router.currentRoute, target.href)
router.install()
```
