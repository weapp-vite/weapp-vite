## 返回值型页面 Hook

<WevuApiDocGroup :api-count="4" summary="声明分享、收藏和退出状态等需要向小程序宿主返回配置的 hook。" title="返回值型页面 Hook">

### `onShareAppMessage()` {#onshareappmessage}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onShareAppMessage']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-return)。

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于分享配置。

### `onShareTimeline()` {#onsharetimeline}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onShareTimeline']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-return)。

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于朋友圈分享配置。

### `onAddToFavorites()` {#onaddtofavorites}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onAddToFavorites']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-return)。

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于收藏配置。

### `onSaveExitState()` {#onsaveexitstate}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onSaveExitState']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-return)。

- 作用域：`Page`
- 源码行为：单实例 Hook（`single: true`），返回值用于退出状态保存。

### 本组示例 {#example-lifecycle-return}

返回值直接交给小程序宿主，字段结构应遵循对应平台契约。

```vue
<script setup lang="ts">
import { onAddToFavorites, onShareAppMessage, onShareTimeline } from 'wevu'

onShareAppMessage(() => ({ title: '商品详情', path: '/pages/goods/index?id=42' }))
onShareTimeline(() => ({ title: '商品详情', query: 'id=42' }))
onAddToFavorites(() => ({ title: '商品详情', query: 'id=42' }))
</script>
```

</WevuApiDocGroup>
