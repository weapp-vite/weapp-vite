## Router 实例

### `router.nativeRouter` {#router-nativerouter}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['nativeRouter']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 调用形式接近 Vue Router，但导航最终映射到 `navigateTo`、`redirectTo`、`switchTab`、`reLaunch` 或 `navigateBack`，受页面栈和 tabBar 约束。

**示例：** 见 [Router 实例共用示例](/wevu/api/router#router-examples)。

Router 内部使用的原生 `SetupContextRouter`。

### `router.options` {#router-options}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['options']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 调用形式接近 Vue Router，但导航最终映射到 `navigateTo`、`redirectTo`、`switchTab`、`reLaunch` 或 `navigateBack`，受页面栈和 tabBar 约束。

**示例：** 见 [Router 实例共用示例](/wevu/api/router#router-examples)。

创建 Router 时使用的只读、规范化选项快照。

### `router.currentRoute` {#router-currentroute}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['currentRoute']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 调用形式接近 Vue Router，但导航最终映射到 `navigateTo`、`redirectTo`、`switchTab`、`reLaunch` 或 `navigateBack`，受页面栈和 tabBar 约束。

**示例：** 见 [Router 实例共用示例](/wevu/api/router#router-examples)。

当前只读路由位置，包含 path、query、params、matched 和 redirectedFrom 等信息。

### `router.install()` {#router-install}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['install']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** Vue Router 安装组件与全局属性；Wevu 只注册默认 Router，并在宿主对象支持时写入 `$router`。

**示例：** 见 [Router 实例共用示例](/wevu/api/router#router-examples)。

注册当前 Router，并在 App 支持 `globalProperties` 时写入 `$router`。

### `router.resolve()` {#router-resolve}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['resolve']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 调用形式接近 Vue Router，但导航最终映射到 `navigateTo`、`redirectTo`、`switchTab`、`reLaunch` 或 `navigateBack`，受页面栈和 tabBar 约束。

**示例：** 见 [Router 实例共用示例](/wevu/api/router#router-examples)。

基于当前路由和 Router 配置解析目标位置，不执行实际跳转。

### `router.isReady()` {#router-isready}

<!-- api-reference-details -->

**类型签名：** `RouterNavigation['isReady']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 调用形式接近 Vue Router，但导航最终映射到 `navigateTo`、`redirectTo`、`switchTab`、`reLaunch` 或 `navigateBack`，受页面栈和 tabBar 约束。

**示例：** 见 [Router 实例共用示例](/wevu/api/router#router-examples)。

返回 Router 就绪 Promise；当前小程序实现创建后即可就绪。
