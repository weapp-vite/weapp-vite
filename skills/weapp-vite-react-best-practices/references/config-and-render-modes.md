# React 配置与渲染模式

## 事实来源

- `packages/weapp-vite/src/types/config/**`
- `packages/weapp-vite/src/plugins/react/**`
- `website/config/react.md`
- `docs/integration/react.md`

## 配置基线

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    react: {
      compiler: false,
      devWarnings: true,
      renderMode: 'auto',
    },
  },
})
```

- `react: true` 等价于使用默认配置。
- `auto` 优先静态 WXML/binding slots，并只为不含 bridge 的动态结构使用 reconciler tree。
- `dynamic` 全量使用 reconciler tree，适合排障，但不能承载原生组件 bridge。
- `static` 强制静态证明；遇到列表、条件或其他不受支持结构时应失败。

## React Compiler

- 默认关闭，不把 Compiler 当作 React runtime 的前置条件。
- 显式启用时使用 `compiler: { engine: 'swc', compilationMode: 'infer' }`，并安装可选依赖 `@swc/core`。
- native transform 加载或执行失败时应回退 Oxc JSX transform，并输出带文件位置的 warning。
- 检查 sourcemap、warning 和运行时结果，不只检查编译命令退出码。

## 平台与所有权

- 当前 React runtime 只承诺微信小程序。
- `.jsx` / `.tsx` 的 owner 是项目级选择；启用 `weapp.react` 后不要在同一构建中写 Wevu JSX。
- `.vue` 仍可由 Wevu compiler 处理，但需显式安装 `wevu`，并通过自定义组件 bridge 与 React 互操作。
