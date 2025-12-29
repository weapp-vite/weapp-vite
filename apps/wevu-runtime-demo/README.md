# wevu-runtime-demo

使用 `wevu` 运行时 API 为原生小程序页面提供响应式能力的最小示例。项目核心仍然通过 TypeScript + WXML/WXSS 直接演示运行时用法，并额外提供一个 Vue SFC 页面（`pages/slot`）展示插槽写法。

## 快速开始

```bash
pnpm --filter wevu-runtime-demo dev
```

首次启动会自动构建依赖包，完成后即可以微信开发者工具导入 `dist/` 目录查看。

## 场景说明

- 全局：`src/app.ts` 用 `createApp` 注册运行时，集中维护主题与日志。
- 页面：`defineComponent` 直接绑定原生 `Component`（在微信小程序中可同时用于页面/组件），在 `setup` 里使用 `ref`、`computed`、`watch`、`watchEffect`、`provide/inject` 等 API。
- Vue 插槽：`pages/slot` 通过 Vue SFC 展示默认、具名与作用域插槽，并复用 wevu 响应式数据。
- Store：`src/stores/counter.ts` 用 `defineStore` 与 `storeToRefs` 展示跨页面共享状态。
- 分享：`src/pages/share` 通过 wevu 的 onShare 钩子读取响应式标题/路径，无需 `.vue` 模式。
- 其他：生命周期监听、事件通信、分包 + 动态 import、性能基准等均保持纯 wevu 运行时形态。

如果仅希望在运行时复用 `wevu` 的响应式系统，而不引入 `.vue` 模式或编译插件，可以直接参考本示例的结构。
