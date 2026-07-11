## Vue 风格选项

### `props` {#props}

<!-- api-reference-details -->

**类型签名：** `DefineComponentOptions['props']`

**运行时说明：** 该选项最终注册到小程序 `Component()` 定义；页面与组件共享注册模型，但宿主只会调用当前实例支持的字段。

**Vue 差异：** 名称沿用 Vue Options API，但 Wevu 最终生成小程序 `Component()` 配置，没有 DOM、Virtual DOM 或浏览器组件实例；生命周期应使用 Wevu/宿主对应项。

**示例：** 见 [Options API共用示例](/wevu/api/options-api#options-api-examples)。

支持数组、对象和类型声明，并在注册阶段转换为小程序 `properties`。

### `emits` {#emits}

<!-- api-reference-details -->

**类型签名：** `DefineComponentOptions['emits']`

**运行时说明：** 该选项最终注册到小程序 `Component()` 定义；页面与组件共享注册模型，但宿主只会调用当前实例支持的字段。

**Vue 差异：** 名称沿用 Vue Options API，但 Wevu 最终生成小程序 `Component()` 配置，没有 DOM、Virtual DOM 或浏览器组件实例；生命周期应使用 Wevu/宿主对应项。

**示例：** 见 [Options API共用示例](/wevu/api/options-api#options-api-examples)。

用于声明组件事件；实际派发通过小程序组件事件系统完成。

### `data` {#data}

<!-- api-reference-details -->

**类型签名：** `DefineComponentOptions['data']`

**运行时说明：** 该选项最终注册到小程序 `Component()` 定义；页面与组件共享注册模型，但宿主只会调用当前实例支持的字段。

**Vue 差异：** 名称沿用 Vue Options API，但 Wevu 最终生成小程序 `Component()` 配置，没有 DOM、Virtual DOM 或浏览器组件实例；生命周期应使用 Wevu/宿主对应项。

**示例：** 见 [Options API共用示例](/wevu/api/options-api#options-api-examples)。

支持对象或返回初始状态的函数，推荐使用函数形式。

### `setup` {#setup}

<!-- api-reference-details -->

**类型签名：** `DefineComponentOptions['setup']`

**运行时说明：** 该选项最终注册到小程序 `Component()` 定义；页面与组件共享注册模型，但宿主只会调用当前实例支持的字段。

**Vue 差异：** 名称沿用 Vue Options API，但 Wevu 最终生成小程序 `Component()` 配置，没有 DOM、Virtual DOM 或浏览器组件实例；生命周期应使用 Wevu/宿主对应项。

**示例：** 见 [Options API共用示例](/wevu/api/options-api#options-api-examples)。

在 Wevu setup 上下文中执行。默认在组件 `attached` 阶段运行，与 Vue 组件创建时机存在差异。

### `computed` {#computed}

<!-- api-reference-details -->

**类型签名：** `DefineComponentOptions['computed']`

**运行时说明：** 该选项最终注册到小程序 `Component()` 定义；页面与组件共享注册模型，但宿主只会调用当前实例支持的字段。

**Vue 差异：** 名称沿用 Vue Options API，但 Wevu 最终生成小程序 `Component()` 配置，没有 DOM、Virtual DOM 或浏览器组件实例；生命周期应使用 Wevu/宿主对应项。

**示例：** 见 [Options API共用示例](/wevu/api/options-api#options-api-examples)。

参与 Wevu 响应式快照和 `setData` 差量更新，不是 Vue DOM 渲染器的 computed 调度链路。

### `methods` {#methods}

<!-- api-reference-details -->

**类型签名：** `DefineComponentOptions['methods']`

**运行时说明：** 该选项最终注册到小程序 `Component()` 定义；页面与组件共享注册模型，但宿主只会调用当前实例支持的字段。

**Vue 差异：** 名称沿用 Vue Options API，但 Wevu 最终生成小程序 `Component()` 配置，没有 DOM、Virtual DOM 或浏览器组件实例；生命周期应使用 Wevu/宿主对应项。

**示例：** 见 [Options API共用示例](/wevu/api/options-api#options-api-examples)。

方法会绑定到小程序公开实例，并可供模板事件处理器调用。

### `watch` {#watch}

<!-- api-reference-details -->

**类型签名：** `DefineComponentOptions['watch']`

**运行时说明：** 该选项最终注册到小程序 `Component()` 定义；页面与组件共享注册模型，但宿主只会调用当前实例支持的字段。

**Vue 差异：** 名称沿用 Vue Options API，但 Wevu 最终生成小程序 `Component()` 配置，没有 DOM、Virtual DOM 或浏览器组件实例；生命周期应使用 Wevu/宿主对应项。

**示例：** 见 [Options API共用示例](/wevu/api/options-api#options-api-examples)。

监听 data、props 或 computed 路径；调度和深度监听能力以 [Reactivity API](/wevu/api/reactivity#watch) 为准。
