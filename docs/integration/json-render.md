# Wevu JSON renderer

`@wevu/json-render` 是独立的实验性 Wevu renderer 包，直接依赖 `@json-render/core@0.21.0`，提供组件目录、状态与事件连接、递归 SFC 和流式更新。

- 包源码与完整使用说明：`packages-runtime/json-render/README.md`。
- 应用示例：`apps/wevu-json-render-demo`，业务数据、订单组件和售后动作保留在应用中。
- 站点入口：`website/packages/wevu-json-render.md`。
- 构建期入口：`@wevu/json-render/resolver` 的 `JsonRendererResolver()`。
- 运行时入口：`createJsonRenderer` / `useJsonRenderer`，通过 `CatalogSpec`、`RenderNode`、`RendererEvent` 连接预编译组件。

先构建包，再验证下游应用。真实微信 DevTools 和 headless 复用 `e2e/ide/wevu-json-render.runtime.test.ts`，测试命令必须全局串行。包未执行 npm 发布，不承诺完整上游协议、Web Vue 动态组件或其他平台支持。
