# 底层编译插件协议

`weapp.compilerPlugins` 是 `weapp-vite` 提供的底层编译扩展入口。第三方包可以通过公开的 `WeappCompilerPlugin` 协议声明源码所有权，并参与 CSS、WXML、JavaScript、bundle 和 HMR 生命周期。

```ts
import type { WeappCompilerPlugin } from 'weapp-vite/config'
import { defineConfig } from 'weapp-vite/config'

const compilerPlugin: WeappCompilerPlugin = {
  name: 'example-compiler',
  capabilities: { style: true, template: true, script: true, hmr: true },
  create() {
    return {
      claimSource: ({ id }) => id.endsWith('.css'),
      transformSource: ({ code }) => ({ code }),
      transformCss: ({ code }) => ({ code }),
    }
  },
}

export default defineConfig({
  weapp: {
    compilerPlugins: [compilerPlugin],
  },
})
```

每个源码入口首期只能由一个 provider 接管。provider 可以通过 `claimSource` 返回入口标识和依赖，再在 controller 中实现产物转换、bundle 最终化、监听、HMR 和 `dispose`。provider 的内部状态由 provider 自己维护，host 只处理稳定的转换结果、source map、依赖、入口标识和失效集合。

`weapp.tailwindcss` 仍然是内置 Tailwind adapter 的兼容门面。UnoCSS 等实现可以作为独立包消费同一协议；首期不内置 UnoCSS adapter。
