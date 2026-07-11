## 页面事件 Hook

<WevuApiDocGroup :api-count="6" summary="响应下拉刷新、触底、滚动、路由完成、tab 点击和尺寸变化。" title="页面事件 Hook">

### `onPullDownRefresh()` {#onpulldownrefresh}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onPullDownRefresh']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-events)。

- 作用域：`Page`
- 源码行为：注册到页面 `onPullDownRefresh`。

### `onReachBottom()` {#onreachbottom}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onReachBottom']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-events)。

- 作用域：`Page`
- 源码行为：注册到页面 `onReachBottom`。

### `onPageScroll()` {#onpagescroll}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onPageScroll']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-events)。

- 作用域：`Page`
- 源码行为：注册到页面 `onPageScroll`。

### `onRouteDone()` {#onroutedone}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onRouteDone']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-events)。

- 作用域：`Page / Component`
- 源码行为：注册到 `onRouteDone`；组件通过 `pageLifetimes.routeDone` 桥接触发。

### `onTabItemTap()` {#ontabitemtap}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onTabItemTap']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-events)。

- 作用域：`Page`
- 源码行为：注册到页面 `onTabItemTap`。

### `onResize()` {#onresize}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onResize']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-events)。

- 作用域：`Page / Component`
- 源码行为：注册到 `onResize`；组件通过 `pageLifetimes.resize` 桥接触发。

### 本组示例 {#example-lifecycle-events}

高频滚动回调只更新必要状态，耗时请求放在低频事件中。

```vue
<script setup lang="ts">
import { onPageScroll, onPullDownRefresh, onReachBottom, ref } from 'wevu'

const scrollTop = ref(0)
onPageScroll((event) => {
  scrollTop.value = event.scrollTop
})
onReachBottom(() => loadNextPage())
onPullDownRefresh(async () => {
  await reloadList()
  wx.stopPullDownRefresh()
})
</script>
```

</WevuApiDocGroup>
