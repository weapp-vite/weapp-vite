## 组件扩展 Hook

### `onAttached()` {#onattached}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onAttached']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-component)。

- 作用域：`Component`
- 源码行为：在组件 `lifetimes.attached` 阶段触发。

### `onDetached()` {#ondetached}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onDetached']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-component)。

- 作用域：`Component`
- 源码行为：在组件 `lifetimes.detached` 阶段触发。

### `onMoved()` {#onmoved}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onMoved']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-component)。

- 作用域：`Component`
- 源码行为：注册到 `lifetimes.moved`。

### 本组示例 {#example-lifecycle-component}

组件资源在 attached 后创建，并在 detached 中释放。

```vue
<script setup lang="ts">
import { onAttached, onDetached, onMoved } from 'wevu'

let observer: WechatMiniprogram.IntersectionObserver | undefined

onAttached(() => {
  observer = wx.createIntersectionObserver()
})
onMoved(() => console.log('component moved'))
onDetached(() => {
  observer?.disconnect()
})
</script>
```
