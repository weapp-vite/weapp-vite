## setData 排除标记

### `markNoSetData()` {#marknosetdata}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['markNoSetData']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [运行时桥接共用示例](/wevu/api/runtime-bridge#runtime-bridge-examples)。

- 类型入口：`<T>(value: T) => T`
- 用途：标记对象不参与 `setData` 快照同步。

### `isNoSetData()` {#isnosetdata}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['isNoSetData']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [运行时桥接共用示例](/wevu/api/runtime-bridge#runtime-bridge-examples)。

- 类型入口：`boolean`
- 用途：判断对象是否被标记为 no-setData。
