# wevu-runtime-demo

使用 `wevu` 运行时 API 为原生小程序页面提供响应式能力的最小示例。示例演示如何通过 `defineComponent` 在页面生命周期里挂载 `wevu` 实例、同步 `setData`、注册侦听器以及通过事件处理函数操作响应式数据。

## 快速开始

```bash
pnpm --filter wevu-runtime-demo dev
```

首次启动会自动构建依赖包，完成后即可以微信开发者工具导入 `dist/` 目录查看。

## 场景说明

- 在 `src/app.ts` 中使用 `createApp` 直接注册全局运行时（无需调用 `App()`），集中维护应用级状态与日志。
- 在 `src/pages/runtime/index.ts` 中使用 `defineComponent` 绑定微信小程序的 `Component/Page` 构造器，并在内部自动挂载 `wevu` 运行时。
- 借助 `runtime.methods`、`runtime.bindModel()` 处理按钮点击、输入事件，实现计数器和待办列表的响应式交互。
- 通过 `setup()` 中的 `watch` 记录数据变化，展示仅依赖运行时代码即可替换手动维护的 `setData`。

如果仅希望在运行时复用 `wevu` 的响应式系统，而不引入 `.vue` 模式或编译插件，可以直接参考本示例的结构。
