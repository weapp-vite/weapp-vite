# 自定义 autoImportComponents Resolver

`weapp.autoImportComponents.resolvers` 用来把 WXML 里的组件标签（例如 `<van-button>`）解析成小程序 `usingComponents` 需要的 `from` 路径（例如 `@vant/weapp/button`）。

这篇文档给出一个“可直接复制”的 Resolver 实现模板，并解释哪些能力会影响：

- 自动写入 `usingComponents`
- 生成 `auto-import-components.json`
- 生成 `typed-components.d.ts` / `mini-program.html-data.json`

## Resolver 是什么

Resolver 支持两种写法（推荐对象写法）：

```ts
// 函数写法：返回 { name, from } 或 void
type ResolverFn = (componentName: string, baseName: string) => { name: string, from: string } | void

// 对象写法：提供 components 映射表，或提供 resolve() 方法
interface ResolverObject {
  components?: Record<string, string>
  resolve?: (componentName: string, baseName: string) => { name: string, from: string } | void
  resolveExternalMetadataCandidates?: (from: string) => {
    packageName: string
    dts: string[]
    js: string[]
  } | undefined
}
```

> [!TIP]
> weapp-vite 内置的 `VantResolver` / `TDesignResolver` / `WeuiResolver` 也是对象 resolver。自定义 resolver 推荐优先用对象写法：结构更清晰，也更方便提供 `components` / metadata 信息。

- `componentName`: 模板中的标签名（如 `van-button`、`t-tabs`、`HelloWorld`）
- `baseName`: 当前处理的文件名（用于进阶场景：按页面/组件上下文做差异化映射）
- 返回值：告诉 weapp-vite 把该标签注册到哪个 `from`

## 推荐：对象写法（静态映射）

如果你已经有一份“标签名 → from”的静态表，推荐直接用对象写法（无需写函数逻辑）：

```ts
import type { Resolver } from 'weapp-vite/auto-import-components/resolvers'
import { defineConfig } from 'weapp-vite/config'

const resolver: Resolver = {
  components: {
    'x-button': 'my-ui/button/button',
    'x-dialog': 'my-ui/dialog/dialog',
  },
}

export default defineConfig({
  weapp: {
    autoImportComponents: {
      resolvers: [resolver],
    },
  },
})
```

> [!TIP]
> 这个实现已经足够让 weapp-vite 在构建时自动补全 `usingComponents`，并且便于参与 `auto-import-components.json` / `typed-components.d.ts` 等产物生成。

## 建议增强 1：暴露 `resolver.components`（用于“全量生成”）

当你开启 `typedComponents` / `htmlCustomData` 或希望输出的 `auto-import-components.json` 里包含第三方库组件时，建议维护 `resolver.components`：

```ts
import type { Resolver } from 'weapp-vite/auto-import-components/resolvers'

const components = ['button', 'tabs', 'dialog'] as const

const map = Object.fromEntries(
  components.map(name => [`x-${name}`, `my-ui/${name}/${name}`]),
)

export const MyUiResolver: Resolver = {
  components: Object.freeze({ ...map }),
  resolve(componentName) {
    const from = map[componentName]
    if (!from) {
      return
    }
    return { name: componentName, from }
  },
}
```

- `resolver.components` 会被 weapp-vite 用来收集“该 resolver 支持哪些组件”。
- 如果你只写了动态解析逻辑但没有 `components` 映射，通常仍能自动注册 `usingComponents`，但“全量类型/补全文件”可能无法覆盖到这些组件。

## 建议增强 2：支持第三方组件库 props 类型解析

如果你的 `from` 指向 npm 包（例如 `@vant/weapp/button`），并且希望 weapp-vite 在生成 `typed-components.d.ts` 时能从第三方库读取 `.d.ts` / `.js` 里的 props 信息，可以实现：

```ts
resolver.resolveExternalMetadataCandidates = (from) => {
  // 命中该 resolver 管理的包时返回候选路径
  return {
    packageName: 'my-ui',
    dts: ['dist/button/index.d.ts'],
    js: ['dist/button/index.js'],
  }
}
```

完整示例（简化版）：

```ts
import type { Resolver } from 'weapp-vite/auto-import-components/resolvers'

const resolver: Resolver = {
  components: {
    'x-button': 'my-ui/button',
  },
  resolve(componentName) {
    const from = componentName === 'x-button' ? 'my-ui/button' : undefined
    if (!from) {
      return
    }
    return { name: componentName, from }
  },
  resolveExternalMetadataCandidates(from) {
    if (!from.startsWith('my-ui/')) {
      return
    }
    const component = from.slice('my-ui/'.length)
    if (!component) {
      return
    }
    return {
      packageName: 'my-ui',
      dts: [`dist/${component}/index.d.ts`],
      js: [`dist/${component}/index.js`],
    }
  },
}
```

> [!NOTE]
> `resolveExternalMetadataCandidates` 的目标不是“让组件能被解析”，而是“告诉 weapp-vite 到第三方依赖包里去哪里找 metadata 文件”，用于类型与补全产物。

## 进阶：函数写法（按需动态解析）

如果你需要按上下文动态解析（例如同一个标签在不同页面映射不同 `from`），可以使用函数写法：

```ts
import type { Resolver } from 'weapp-vite/auto-import-components/resolvers'

export function DynamicResolver(): Resolver {
  return (componentName, baseName) => {
    if (componentName !== 'x-button') {
      return
    }
    const from = baseName.includes('admin')
      ? 'my-ui-admin/button/button'
      : 'my-ui/button/button'
    return { name: componentName, from }
  }
}
```

## 参考实现

- `weapp-vite` 内置 Resolver：`VantResolver`、`TDesignResolver`、`WeuiResolver`
- 配置入口：[`weapp.autoImportComponents`](/config/auto-import-components.md#weapp-autoimportcomponents)
