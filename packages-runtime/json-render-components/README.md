# @wevu/json-render-components

`@wevu/json-render` 自动依赖的预编译小程序组件资源包。消费应用需在 dependencies 中同时声明主适配包和本包，供小程序 npm 构建显式识别；业务代码只使用主包 API 和 `JsonRendererResolver()`。

- `components/renderer/index.vue`：基础控件、递归节点和 `custom-node` 泛型转发。
- `components/fallback`：未提供业务泛型时的默认原生组件。
- `src/types.ts`：主包与组件共享的可序列化 `RenderNode` / `RendererEvent` 契约，通过 `./types` 仅导出类型。
- `dist/miniprogram`：由 weapp-vite lib 模式原生 emit，保持递归引用、默认组件和样式的相对路径。

本包不承载应用状态、协议解释、动作处理或 json-render Core。响应式 API 留在主包的 ESM 入口，随宿主打包，从而避免应用与组件库之间的状态依赖图分裂。

```sh
pnpm --filter @wevu/json-render-components build
pnpm --filter @wevu/json-render-components typecheck
pnpm --filter @wevu/json-render-components test:types
```

原生组件注册次数与无动态求值由消费应用的隔离执行测试覆盖；运行时由 `e2e/ide/wevu-json-render.runtime.test.ts` 同时在 headless 和微信 DevTools 验证。
