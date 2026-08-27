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
