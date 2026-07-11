## 实例与上下文访问 API

### `getCurrentInstance()` {#getcurrentinstance}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['getCurrentInstance']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [Setup 与宿主能力共用示例](/wevu/api/setup-context#setup-context-examples)。

- 用途：获取当前运行时实例。
- 源码：`runtime/hooks.ts`。

### `getCurrentSetupContext()` {#getcurrentsetupcontext}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['getCurrentSetupContext']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [Setup 与宿主能力共用示例](/wevu/api/setup-context#setup-context-examples)。

- 用途：获取当前 setup context。
- 源码：`runtime/hooks.ts`。
