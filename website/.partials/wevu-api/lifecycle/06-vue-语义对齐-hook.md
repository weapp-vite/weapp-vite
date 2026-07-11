## Vue 语义对齐 Hook

<WevuApiDocGroup :api-count="10" summary="对照 Vue 生命周期理解 Wevu 的宿主映射、更新批次和无 SSR 边界。" title="Vue 语义对齐 Hook">

### `onBeforeMount()` {#onbeforemount}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onBeforeMount']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 没有 DOM mount 阶段；该回调发生在小程序实例已创建、首次宿主渲染提交之前。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `beforeMount`
- 源码行为：在 `setup()` 内同步立即执行。

### `onMounted()` {#onmounted}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onMounted']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 对应宿主 `ready`，不是浏览器 DOM 插入完成；此时才适合执行节点查询。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `mounted`
- 源码行为：映射到 `onReady`。

### `onBeforeUpdate()` {#onbeforeupdate}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onBeforeUpdate']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 围绕 Wevu 即将提交的 `setData` 批次触发，而不是 Virtual DOM patch。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `beforeUpdate`
- 源码行为：映射到内部 `__wevuOnBeforeUpdate`。

### `onUpdated()` {#onupdated}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onUpdated']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 在当前 `setData` 更新批次完成后触发，不能据此假设浏览器布局或 `requestAnimationFrame` 语义。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `updated`
- 源码行为：映射到内部 `__wevuOnUpdated`。

### `onBeforeUnmount()` {#onbeforeunmount}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onBeforeUnmount']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 对应页面卸载或组件移除前的清理阶段，不涉及 DOM unmount。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `beforeUnmount`
- 源码行为：在 `setup()` 内同步立即执行（小程序无对应原生 before-unmount）。

### `onUnmounted()` {#onunmounted}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onUnmounted']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 对应宿主 `detached`/页面卸载后的销毁阶段。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `unmounted`
- 源码行为：映射到 `onUnload`。

### `onActivated()` {#onactivated}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onActivated']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 映射到页面或组件重新可见的宿主生命周期，不依赖 Vue `<KeepAlive>`。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `activated`
- 源码行为：映射到 `onShow`。

### `onDeactivated()` {#ondeactivated}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onDeactivated']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 映射到宿主隐藏阶段，不表示 `<KeepAlive>` 缓存树被停用。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `deactivated`
- 源码行为：映射到 `onHide`。

### `onErrorCaptured()` {#onerrorcaptured}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onErrorCaptured']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 捕获 Wevu setup、渲染和宿主生命周期链路中的错误，不具备完整 Vue 组件树错误传播语义。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `errorCaptured`
- 源码行为：映射到 `onError` 包装调用。

### `onServerPrefetch()` {#onserverprefetch}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['onServerPrefetch']`

**运行时说明：** 必须在同步 `setup()` 阶段注册，运行时才能把回调绑定到当前 App、页面或组件实例；不要在 `await` 之后注册。

**Vue 差异：** 小程序没有 SSR；为迁移兼容保留该 hook，但运行时不会执行预取。

**示例：** 见 [本组示例](/wevu/api/lifecycle#example-lifecycle-vue)。

- 对齐语义：Vue `serverPrefetch`
- 源码行为：保留 API 形态，仅做调用时机校验，不执行实际逻辑。

### 本组示例 {#example-lifecycle-vue}

这些名称接近 Vue，但时机围绕宿主 ready、setData 和 detached。

```vue
<script setup lang="ts">
import { onBeforeUpdate, onMounted, onServerPrefetch, onUnmounted, onUpdated } from 'wevu'

onMounted(() => console.log('宿主 ready，可开始节点查询'))
onBeforeUpdate(() => console.log('setData 提交前'))
onUpdated(() => console.log('setData 批次完成'))
onUnmounted(() => console.log('宿主实例已销毁'))

// 小程序没有 SSR，这个兼容 hook 不会执行。
onServerPrefetch(async () => {})
</script>
```

</WevuApiDocGroup>
