# Wevu A2UI renderer

`@wevu/a2ui` 是独立的实验性 A2UI 1.0 运行时适配包，直接依赖 `@a2ui/web_core@0.15.0`，提供 surface 会话、视图投影、输入回写与动作外发，不含具体渲染组件。

- 包源码与完整使用说明：`packages-runtime/a2ui/README.md`。
- 应用示例：`apps/wevu-a2ui-demo`，宿主递归组件、售后目录与假 agent 回包保留在应用中。
- 站点入口：`website/packages/wevu-a2ui.md`。
- 运行时入口：`createA2uiSession`，通过 `A2uiSurfaceView`、`A2uiNode`、`A2uiInteraction`、`A2uiActionMessage` 连接宿主 SFC。

预编译的通用宿主组件包尚未提供，消费项目当前自带递归组件并按 `A2uiNode.type` 静态分支；接入不需要构建期 resolver。

先构建包，再验证下游应用。真实微信 DevTools 和 headless 复用 `e2e/ide/wevu-a2ui.runtime.test.ts`，测试命令必须全局串行。包未执行 npm 发布，不承诺完整 Basic Catalog、函数调用与校验规则，或其他平台支持。
