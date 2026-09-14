# @weapp-vite/glass-easel-web-adapter

实验性的 glass-easel Web 组件后端。它复用 glass-easel 官方组件树、模板编译和浏览器 backend，向 weapp-vite Web host 提供受控的组件挂载、数据更新、事件和生命周期桥接。

该包不会替换 `@weapp-vite/web`，也不实现页面路由、WXSS/rpx、微信 API 或全部原生组件。调用方必须显式创建 adapter；当前默认 Web runtime 不受影响。

`mountComponent` 的第四个参数可传入 `slots`，用于将受控 HTML 投影到模板中的 `<slot />`。这是 PoC 的 DOM 桥接，复杂 slot 关系仍需由后续组件树适配器实现。

## 验证

```bash
pnpm --filter @weapp-vite/glass-easel-web-adapter typecheck
pnpm --filter @weapp-vite/glass-easel-web-adapter test
pnpm --filter @weapp-vite/glass-easel-web-adapter test:types
pnpm --filter @weapp-vite/glass-easel-web-adapter test:browser
pnpm --filter @weapp-vite/glass-easel-web-adapter build
```
