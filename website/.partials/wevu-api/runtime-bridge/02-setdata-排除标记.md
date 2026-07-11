## setData 排除标记

<WevuApiDocGroup :api-count="2" summary="阻止不适合序列化的对象进入小程序 setData 快照。" title="setData 排除标记">

### `markNoSetData()` {#marknosetdata}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['markNoSetData']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/runtime-bridge#example-runtime-no-setdata)。

- 类型入口：`<T>(value: T) => T`
- 用途：标记对象不参与 `setData` 快照同步。

### `isNoSetData()` {#isnosetdata}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['isNoSetData']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/runtime-bridge#example-runtime-no-setdata)。

- 类型入口：`boolean`
- 用途：判断对象是否被标记为 no-setData。

### 本组示例 {#example-runtime-no-setdata}

原生实例和 SDK 对象不应进入模板快照，可以显式排除。

```ts
import { isNoSetData, markNoSetData, reactive } from 'wevu'

const player = markNoSetData(wx.createVideoContext('player'))
const state = reactive({ title: '视频详情', player })

console.log(isNoSetData(state.player))
```

</WevuApiDocGroup>
