# @wevu/api

`@wevu/api` 是 `@weapp-core/api` 的兼容入口，用于保持现有 `wpi`、`createWeapi` 和 `Weapi*` 类型不变。

新项目请直接安装框架与运行时无关的核心包：

```bash
pnpm add @weapp-core/api
```

```ts
import { api, createApi } from '@weapp-core/api'

const hostApi = createApi({
  adapter: wx,
  platform: 'wechat',
})

await hostApi.request({
  url: '/api/user',
})
```

旧入口仍可继续使用：

```ts
import { createWeapi, wpi } from '@wevu/api'
```

`@wevu/api` 不再维护独立实现，所有能力、平台适配、类型声明与兼容性修复均由 `@weapp-core/api` 提供。

## Vitest mock

兼容入口提供同一套类型安全 mock。Vitest 配置使用对应 setup 子路径：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['@wevu/api/vitest/setup'],
  },
})
```

```ts
import { wpiMock } from '@wevu/api/vitest'

wpiMock.request.mockResolvedValue(responseFixture)
```

`@wevu/api/vitest/setup` 会同时替换 `@weapp-core/api` 与 `@wevu/api` 导入的 `api` / `wpi`，两层入口共享同一单例。也可以使用 `createApiMock()` / `createWpiMock()` 创建隔离实例，或用 `resetApiMock()` 手动重置指定实例。

该能力只 mock API 门面；页面、组件、WXML 与宿主运行时行为仍由 `@mpcore/test` 覆盖。
