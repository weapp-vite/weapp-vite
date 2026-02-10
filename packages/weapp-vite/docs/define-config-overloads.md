# defineConfig 重载与类型推导说明

本文用于说明 `weapp-vite/config` 中 `defineConfig` 的重载行为、推荐写法，以及为什么某些写法会影响编辑器里的 Hover 文档和跳转能力。

## 目标

`defineConfig` 的核心目标有两个：

1. 让 `vite.config.ts` 中 `weapp` 配置获得稳定的字段提示与类型校验。
2. 保留扩展能力（允许额外自定义字段），兼顾严格与灵活。

## 支持的入参形态

`defineConfig` 支持以下主要形态：

1. **对象配置**：`defineConfig({ ... })`
2. **Promise 对象配置**：`defineConfig(Promise.resolve({ ... }))`
3. **无 env 同步函数**：`defineConfig(() => ({ ... }))`
4. **无 env 异步函数**：`defineConfig(async () => ({ ... }))`
5. **有 env 同步函数**：`defineConfig((env) => ({ ... }))`
6. **有 env 异步函数**：`defineConfig(async (env) => ({ ... }))`
7. **有 env 同步/异步混合返回**：`defineConfig((env) => env.command === 'build' ? Promise.resolve(...) : (...))`

## 关键推导规则

### 1) 重载顺序会直接影响编辑器体验

在 TypeScript 中，函数重载按声明顺序匹配。

为了保证 `vite.config.ts` 里对象字面量字段（例如 `weapp.srcRoot`）能拿到**上下文类型**，并正确展示 JSDoc / 支持跳转，需要把更“具体”的同步重载放在前面，避免过早命中宽泛的联合重载。

### 2) 无 env 异步函数的返回值

`defineConfig(async () => ({ ... }))` 对应 `() => UserConfig | Promise<UserConfig>` 的函数签名。

这意味着调用返回函数时，类型是：

- `UserConfig | Promise<UserConfig>`

如果业务侧明确使用 `async`，建议按 Promise 分支处理。

### 3) `UserConfigLoose` 的兜底行为

`defineConfig` 允许对象中带额外字段（例如 `customFeature`），用于兼容插件场景。

但使用这类“宽松扩展”时，额外字段会按更宽泛类型处理，建议：

- 标准字段走官方类型（如 `weapp.srcRoot`）
- 自定义字段尽量在项目内补充独立类型约束

## 推荐写法

### 推荐：无 env 同步函数（最稳定）

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(() => ({
  weapp: {
    srcRoot: 'src',
  },
}))
```

### 推荐：有 env 分支

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(env => ({
  weapp: {
    srcRoot: env.command === 'build' ? 'src-build' : 'src-dev',
  },
}))
```

### 谨慎：过度动态的混合返回

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig((env) => {
  if (env.command === 'build') {
    return Promise.resolve({ weapp: { srcRoot: 'src-build' } })
  }
  return { weapp: { srcRoot: 'src-dev' } }
})
```

这种写法可用，但返回类型会变成联合类型，调用侧需要兼容两种分支。

## 常见问题排查

### Hover 无文档、Command+Click 不能跳转

优先检查：

1. 是否使用了 `import { defineConfig } from 'weapp-vite/config'`
2. 是否在 `tsconfig.node.json` 中包含 `vite.config.ts`
3. 是否命中过于宽泛的重载（会导致字段退化为局部字面量推断）
4. 依赖是否已安装且类型入口可解析

## 回归测试

以下测试用于确保上述行为稳定：

- `packages/weapp-vite/test/config-intellisense.test.ts`
- `packages/weapp-vite/test-d/config-defineConfig.test-d.ts`
