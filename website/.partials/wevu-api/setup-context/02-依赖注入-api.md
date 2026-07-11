## 依赖注入 API

### `provide()` {#provide}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['provide']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/setup-context#example-setup-provide)。

- 用途：在当前组件树提供依赖。
- 源码：`runtime/provide.ts`。

### `inject()` {#inject}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['inject']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/setup-context#example-setup-provide)。

- 用途：从上层读取依赖。
- 源码：`runtime/provide.ts`。

### `provideGlobal()` / `injectGlobal()`（Deprecated） {#provideglobal}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['provideGlobal']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/setup-context#example-setup-provide)。

- 用途：已弃用的全局 provide/inject 兼容入口。
- 说明：当前更推荐优先使用 `provide()` / `inject()`；无实例上下文时，它们本身就会回退到全局存储。
- 源码：`runtime/provide.ts`。

> [!WARNING]
> 这组 API 仅为兼容旧代码而保留，不建议在新代码中继续使用。
> 优先使用 `provide()` / `inject()`；需要稳定的跨页面全局共享时，优先考虑 store。

### 本组示例 {#example-setup-provide}

页面或上层组件提供响应式依赖，下层组件按同一个 key 注入。

```ts
import type { InjectionKey, Ref } from 'wevu'
import { inject, provide, ref } from 'wevu'

const ThemeKey: InjectionKey<Ref<'light' | 'dark'>> = Symbol('theme')

// 上层同步提供。
provide(ThemeKey, ref('light'))

// 下层读取；缺失时使用显式默认值。
const theme = inject(ThemeKey, ref('light'))
```
