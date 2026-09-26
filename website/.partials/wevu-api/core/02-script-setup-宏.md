## Script Setup 宏

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

**运行时说明：** 这是 `<script setup>` 编译期宏，通常直接使用全局宏，无需导入；也可以从 `wevu` 具名导入（包括使用别名），不能作为普通运行时函数动态调用。

**示例：** 见 [本组示例](/wevu/api/core#example-core-macros)。

- 类型入口：`PageMeta` / `PageLayoutMeta`
- 用途：在 `<script setup>` 中声明原有页面元信息和 layout。
- `layout`：沿用既有页面壳语义；在 Vue SFC 中，`props` 对象与键名需要静态可分析，但值可以保留响应式表达式。
- 其他顶层字段：继续作为原有 `PageMeta` 数据处理，不会成为 Router `meta`。
- 职责边界：命名路由使用 `definePage()`；宿主标题、下拉刷新和 `usingComponents` 等使用 `definePageJson()`；组件注册选项使用 `defineOptions()`。

`definePageMeta({ route: ... })` 不会生成命名路由。`definePage()` 是预期使用的独立路由编译宏，与已移除的历史页面注册能力职责不同；旧名 `definePageRoute` 不提供兼容别名。

```vue
<script setup lang="ts">
import { computed } from 'wevu'

const layoutTitle = computed(() => '首页壳')

definePageMeta({
  layout: {
    name: 'default',
    props: { title: layoutTitle.value },
  },
  custom: { section: 'home' },
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

### `defineAppJson()` {#defineappjson}

<!-- api-reference-details -->

**类型签名：** `typeof import('weapp-vite/json')['defineAppJson']`

**运行时说明：** 在 `app.vue` 中作为顶层编译宏使用时，配置会被提取并合并到 `app.json`，运行时零开销。

**示例：** 见 [本组示例](/wevu/api/core#example-json-macros)。

支持直接对象或接收编译上下文的函数；一个 App SFC 应只保留一套 App JSON 声明。

### `definePageJson()` {#definepagejson}

<!-- api-reference-details -->

**类型签名：** `typeof import('weapp-vite/json')['definePageJson']`

**运行时说明：** 在页面 SFC 中提取为页面 JSON，可与 `definePageMeta()`、`definePage()` 分别声明宿主配置、页面元信息/layout 和命名路由信息。

**示例：** 见 [本组示例](/wevu/api/core#example-json-macros)。

常用于导航栏、下拉刷新和 `usingComponents` 等页面配置。

### `defineComponentJson()` {#definecomponentjson}

<!-- api-reference-details -->

**类型签名：** `typeof import('weapp-vite/json')['defineComponentJson']`

**运行时说明：** 在组件 SFC 中提取为组件 JSON，并参与原生组件注册与选项合并。

**示例：** 见 [本组示例](/wevu/api/core#example-json-macros)。

组件角色只使用该宏，不要与页面或 App JSON 宏混用。

### `defineSitemapJson()` {#definesitemapjson}

<!-- api-reference-details -->

**类型签名：** `typeof import('weapp-vite/json')['defineSitemapJson']`

**编译期说明：** 这是 `weapp-vite/json` 导出的类型安全配置辅助函数，不是 Vue SFC 自动提取宏。

**示例：** 见 [本组示例](/wevu/api/core#example-json-macros)。

它返回原配置，适合在独立 sitemap 配置模块中获得结构类型提示。

### `defineThemeJson()` {#definethemejson}

<!-- api-reference-details -->

**类型签名：** `typeof import('weapp-vite/json')['defineThemeJson']`

**编译期说明：** 这是 `weapp-vite/json` 导出的主题配置辅助函数，不是 Vue SFC 自动提取宏。

**示例：** 见 [本组示例](/wevu/api/core#example-json-macros)。

它用于约束 theme 配置结构，本身不注册 Wevu 运行时能力。

### 本组示例 {#example-json-macros}

页面 SFC 中直接使用对应角色的宏，无需保留额外 `<json>` 块。三个声明彼此独立：

```vue
<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '订单',
  enablePullDownRefresh: true,
})

definePageMeta({ layout: 'default', custom: { section: 'orders' } })

definePage({
  name: 'orders',
  meta: { title: '订单业务标签', requiresAuth: true },
})
</script>
```

`definePage({ name, meta })` 参数中的 `meta.title` 是路由业务数据，不会覆盖 `definePageJson()` 的宿主标题。路由宏的完整约束见 [`wevu/router` API](/wevu/api/router#definepage)。

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
