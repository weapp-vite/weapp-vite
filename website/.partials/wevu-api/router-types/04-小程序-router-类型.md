## 小程序 Router 类型

### `SetupContextRouter` {#type-setupcontextrouter}

<!-- api-reference-details -->

**类型签名：**

```ts
interface SetupContextRouter {
  switchTab: (option: MiniProgramRouterSwitchTabOption) => ReturnType<MiniProgramRouter['switchTab']>
  reLaunch: (option: MiniProgramRouterReLaunchOption) => ReturnType<MiniProgramRouter['reLaunch']>
  redirectTo: (option: MiniProgramRouterRedirectToOption) => ReturnType<MiniProgramRouter['redirectTo']>
  navigateTo: (option: MiniProgramRouterNavigateToOption) => ReturnType<MiniProgramRouter['navigateTo']>
  navigateBack: MiniProgramRouter['navigateBack']
}
```

**运行时说明：** 该类型用于约束 小程序 Router 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/router` 以 `import type` 导入。

**示例：** 见 [小程序 Router 类型共用示例](/wevu/api/router-types#router-type-examples)。

Wevu `setup()` 上下文提供的原生小程序 Router。

### `RouterNavigateToOption` {#type-routernavigatetooption}

<!-- api-reference-details -->

**类型签名：**

```ts
type RouterNavigateToOption = MiniProgramRouterNavigateToOption
```

**运行时说明：** 该类型用于约束 小程序 Router 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/router` 以 `import type` 导入。

**示例：** 见 [小程序 Router 类型共用示例](/wevu/api/router-types#router-type-examples)。

类型安全的 `navigateTo` 选项。

### `RouterRedirectToOption` {#type-routerredirecttooption}

<!-- api-reference-details -->

**类型签名：**

```ts
type RouterRedirectToOption = MiniProgramRouterRedirectToOption
```

**运行时说明：** 该类型用于约束 小程序 Router 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/router` 以 `import type` 导入。

**示例：** 见 [小程序 Router 类型共用示例](/wevu/api/router-types#router-type-examples)。

类型安全的 `redirectTo` 选项。

### `RouterReLaunchOption` {#type-routerrelaunchoption}

<!-- api-reference-details -->

**类型签名：**

```ts
type RouterReLaunchOption = MiniProgramRouterReLaunchOption
```

**运行时说明：** 该类型用于约束 小程序 Router 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/router` 以 `import type` 导入。

**示例：** 见 [小程序 Router 类型共用示例](/wevu/api/router-types#router-type-examples)。

类型安全的 `reLaunch` 选项。

### `RouterSwitchTabOption` {#type-routerswitchtaboption}

<!-- api-reference-details -->

**类型签名：**

```ts
type RouterSwitchTabOption = MiniProgramRouterSwitchTabOption
```

**运行时说明：** 该类型用于约束 小程序 Router 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/router` 以 `import type` 导入。

**示例：** 见 [小程序 Router 类型共用示例](/wevu/api/router-types#router-type-examples)。

类型安全的 `switchTab` 选项。

### `TypedRouterUrl` {#type-typedrouterurl}

<!-- api-reference-details -->

**类型签名：**

```ts
type TypedRouterUrl = RouterUrl<ResolveTypedRouterEntries>
```

**运行时说明：** 该类型用于约束 小程序 Router 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/router` 以 `import type` 导入。

**示例：** 见 [小程序 Router 类型共用示例](/wevu/api/router-types#router-type-examples)。

由项目路由类型映射推导出的页面 URL。

### `TypedRouterTabBarUrl` {#type-typedroutertabbarurl}

<!-- api-reference-details -->

**类型签名：**

```ts
type TypedRouterTabBarUrl = RouterPathUrl<ResolveTypedRouterTabBarEntries>
```

**运行时说明：** 该类型用于约束 小程序 Router 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/router` 以 `import type` 导入。

**示例：** 见 [小程序 Router 类型共用示例](/wevu/api/router-types#router-type-examples)。

由项目路由类型映射推导出的 tabBar URL。

### `WevuTypedRouterRouteMap` {#type-wevutypedrouterroutemap}

<!-- api-reference-details -->

**类型签名：**

```ts
interface WevuTypedRouterRouteMap {}
```

**运行时说明：** 该类型用于约束 小程序 Router 类型 的公开契约，不会在运行时产生额外对象；应从 `wevu/router` 以 `import type` 导入。

**示例：** 见 [小程序 Router 类型共用示例](/wevu/api/router-types#router-type-examples)。

供项目声明合并扩展的类型路由映射。
