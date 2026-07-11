## Ref / Proxy 工具

### `toRef()` {#toref}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['toRef']`

**运行时说明：** 依赖变化进入 Wevu 调度队列，并最终收敛为小程序 `setData` 更新；模板状态必须保持可序列化。

**示例：** 见 [本组示例](/wevu/api/reactivity#example-reactivity-ref-tools)。

- 类型入口：`Ref<T>`
- 用途：把对象某个属性映射为 ref。
- 说明：常用于解构后保持响应式引用。

### `toRefs()` {#torefs}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['toRefs']`

**运行时说明：** 依赖变化进入 Wevu 调度队列，并最终收敛为小程序 `setData` 更新；模板状态必须保持可序列化。

**示例：** 见 [本组示例](/wevu/api/reactivity#example-reactivity-ref-tools)。

- 类型入口：`ToRefs<T>`
- 用途：批量把对象属性转换为 ref。
- 说明：适合从 `reactive` 安全解构。

### `unref()` {#unref}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['unref']`

**运行时说明：** 依赖变化进入 Wevu 调度队列，并最终收敛为小程序 `setData` 更新；模板状态必须保持可序列化。

**示例：** 见 [本组示例](/wevu/api/reactivity#example-reactivity-ref-tools)。

- 类型入口：`T`
- 用途：统一读取 `ref.value` 或普通值。
- 说明：减少“值/Ref 双形态”判断分支。

### `toValue()` {#tovalue}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['toValue']`

**运行时说明：** 依赖变化进入 Wevu 调度队列，并最终收敛为小程序 `setData` 更新；模板状态必须保持可序列化。

**示例：** 见 [本组示例](/wevu/api/reactivity#example-reactivity-ref-tools)。

- 类型入口：`MaybeRefOrGetter<T>`
- 用途：统一展开普通值、Ref 或 getter。
- 说明：编写可复用工具函数时很常见。

### `triggerRef()` {#triggerref}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['triggerRef']`

**运行时说明：** 依赖变化进入 Wevu 调度队列，并最终收敛为小程序 `setData` 更新；模板状态必须保持可序列化。

**示例：** 见 [本组示例](/wevu/api/reactivity#example-reactivity-ref-tools)。

- 类型入口：`void`
- 用途：手动触发 `shallowRef` 依赖更新。
- 说明：用于“对象内部变更但引用未变”场景。

### `toRaw()` {#toraw}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['toRaw']`

**运行时说明：** 依赖变化进入 Wevu 调度队列，并最终收敛为小程序 `setData` 更新；模板状态必须保持可序列化。

**示例：** 见 [本组示例](/wevu/api/reactivity#example-reactivity-ref-tools)。

- 类型入口：`T`
- 用途：拿到代理前的原始对象。
- 说明：调试或与第三方库交互时使用。

### `markRaw()` {#markraw}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['markRaw']`

**运行时说明：** 依赖变化进入 Wevu 调度队列，并最终收敛为小程序 `setData` 更新；模板状态必须保持可序列化。

**示例：** 见 [本组示例](/wevu/api/reactivity#example-reactivity-ref-tools)。

- 类型入口：`T`
- 用途：标记对象跳过响应式代理。
- 说明：适用于大型类实例、SDK 对象。

### 本组示例 {#example-reactivity-ref-tools}

工具函数让组合式函数同时接受普通值、Ref 或 getter。

```ts
import { reactive, shallowRef, toRaw, toRef, toRefs, toValue, triggerRef } from 'wevu'

const state = reactive({ count: 0, name: 'Ada' })
const count = toRef(state, 'count')
const fields = toRefs(state)
const config = shallowRef({ enabled: true })

config.value.enabled = false
triggerRef(config)
console.log(toValue(count), fields.name.value, toRaw(state))
```
