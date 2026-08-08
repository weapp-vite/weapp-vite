# React 小程序支持

weapp-vite 提供 React 19 小程序运行时，使用 `@weapp-vite/react` 与项目级 `weapp.react` 配置。

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    react: {
      renderMode: 'auto',
      compiler: false,
    },
  },
})
```

React 项目中的 `.jsx` 和 `.tsx` 会由 React 编译链统一处理，不能与同一构建中的 Wevu JSX 混用。运行时使用 React 19.2.x 和 `react-reconciler` 0.33.x，不依赖 `react-dom`。

`renderMode: 'auto'` 会把可以证明稳定的 JSX 结构生成原生 WXML 和 binding slots，动态结构由 reconciler 的 dynamic tree 处理。排查兼容性时可以使用 `dynamic`；`static` 会在遇到无法静态证明的结构时直接报告诊断。

React Compiler 默认关闭。开启方式：

```ts
export default defineConfig({
  weapp: {
    react: {
      compiler: {
        engine: 'swc',
        compilationMode: 'infer',
      },
    },
  },
})
```

Compiler 依赖可选的 `@swc/core`。native transform 不可用时会回退到 Oxc JSX transform，并输出带文件位置的 warning。

首版目标平台为微信小程序；支付宝和抖音平台暂不在 React runtime 兼容范围内。
