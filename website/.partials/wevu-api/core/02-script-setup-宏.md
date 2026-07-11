## Script Setup 宏

<WevuApiDocGroup :api-count="12" summary="声明 props、事件、model、页面元信息和 App 级初始化逻辑。" title="Script Setup 宏">

### `defineProps()` {#defineprops}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['defineProps']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`ComponentPropsOptions` / `ExtractPropTypes`
- 用途：声明组件 props。
- 说明：支持对象写法与 TS 泛型写法。

### `withDefaults()` {#withdefaults}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['withDefaults']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`ExtractDefaultPropTypes`
- 用途：给类型化 props 设置默认值。
- 说明：通常与 `defineProps<T>()` 配套。

### `defineEmits()` {#defineemits}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['defineEmits']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`EmitsOptions` / `TriggerEventOptions`
- 用途：声明事件与参数类型。
- 说明：支持对象/数组/泛型（含 named tuple）。

### `defineSlots()` {#defineslots}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['defineSlots']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`VNode`
- 用途：声明 slots 类型。

### `defineExpose()` {#defineexpose}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['defineExpose']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`ComponentPublicInstance`
- 用途：显式暴露实例字段。

### `defineModel()` {#definemodel}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['defineModel']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`ModelBinding`
- 用途：声明 `v-model` 绑定。

### `defineOptions()` {#defineoptions}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['defineOptions']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`MiniProgramComponentOptions`
- 用途：在 `<script setup>` 中定义组件配置项。
- Behavior 说明：可直接声明 `behaviors`。当条目来自原生 `Behavior()` 返回值时，编译阶段会保留该表达式并继续后续转换。
- 字段分层：
  - 放进 `options` 的是原生 `ComponentOptions` 字段，例如 `multipleSlots`、`styleIsolation`、`virtualHost`
  - 组件顶层字段例如 `externalClasses`、`behaviors`、`relations`，直接写在 `defineOptions({ ... })` 顶层

示例：

```vue
<script setup lang="ts">
defineOptions({
  externalClasses: ['custom-class'],
  options: {
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },
})
</script>
```

### `definePageMeta()` {#definepagemeta}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['definePageMeta']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`PageMeta` / `PageLayoutMeta`
- 用途：在 `<script setup>` 中声明页面级元信息。
- 说明：常用于声明页面 `layout`，与 Weapp-vite 的自动路由、`routeRules.layout` 和运行时 `setPageLayout()` 保持同一套页面壳心智。

示例：

```vue
<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
</script>
```

### `defineAppSetup()` {#defineappsetup}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['defineAppSetup']`

**运行时说明：** 这是 `<script setup>` 编译期宏，无需从 `wevu` 导入，也不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`RuntimeApp`
- 用途：声明 App 级 setup 初始化逻辑。
- 说明：适合把插件安装、全局 provide、全局 router 初始化等 App 级逻辑收敛到一个同步入口。

### `use()` {#use}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['use']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`WevuPlugin`
- 用途：安装 Wevu 插件。
- 说明：可在 App setup 或受控初始化逻辑中使用；插件如果需要注册 hook，仍必须保持同步注册。

### `mergeModels()` {#mergemodels}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['mergeModels']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`ModelBindingPayload`
- 用途：合并多路 model 绑定结果。

### `useModel()` {#usemodel}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['useModel']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`ModelBinding`
- 用途：运行时读取/写入某个 model。

### 本组示例 {#example-core-macros}

相关宏可以在一个组件中共同声明类型、默认值、事件和 model。

```vue
<script setup lang="ts">
interface Props { title?: string }

defineOptions({ options: { virtualHost: true } })
const props = withDefaults(defineProps<Props>(), { title: '未命名' })
const emit = defineEmits<{ submit: [title: string] }>()
const model = defineModel<number>({ default: 0 })

defineExpose({ submit: () => emit('submit', props.title) })
</script>
```

</WevuApiDocGroup>
