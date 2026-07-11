## 依赖注入 API

### `provide()` {#provide}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['provide']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [Setup 与宿主能力共用示例](/wevu/api/setup-context#setup-context-examples)。

- 用途：在当前组件树提供依赖。
- 源码：`runtime/provide.ts`。

### `inject()` {#inject}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['inject']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [Setup 与宿主能力共用示例](/wevu/api/setup-context#setup-context-examples)。

- 用途：从上层读取依赖。
- 源码：`runtime/provide.ts`。

### `provideGlobal()` / `injectGlobal()`（Deprecated） {#provideglobal}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['provideGlobal']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [Setup 与宿主能力共用示例](/wevu/api/setup-context#setup-context-examples)。

- 用途：已弃用的全局 provide/inject 兼容入口。
- 说明：当前更推荐优先使用 `provide()` / `inject()`；无实例上下文时，它们本身就会回退到全局存储。
- 源码：`runtime/provide.ts`。

> [!WARNING]
> 这组 API 仅为兼容旧代码而保留，不建议在新代码中继续使用。
> 优先使用 `provide()` / `inject()`；需要稳定的跨页面全局共享时，优先考虑 store。
