# React 组件互操作

## 页面 root

- 在原生 `Page`/`Component` 入口中调用 `createReactMiniProgramRoot(this, options)`。
- 将 React 视图保持在相邻 `.tsx` 模块，通过 `root.render(...)` 挂载。
- 把宿主事件交给 `root.dispatchEvent(event)`，并在 `onUnload` / detached 阶段调用 `root.unmount()`。

## 原生与 Wevu bridge

1. 在当前页面或组件 JSON 的 `usingComponents` 注册 tag。
2. 在当前 TSX 顶层用非空字符串字面量调用 `createNativeComponent<Props>(tag)`。
3. 保持 bridge tag 与 JSON key 完全一致。
4. 使用 `HostEventHandler` 描述小程序事件，并从 `event.detail` 读取业务 payload。

事件映射：

- `onValueChange` -> `bind:value-change`
- `onValueChangeCapture` -> `capture-bind:value-change`

## 当前限制

- 不在条件、列表或其他动态结构中创建 bridge。
- 不跨文件声明或 re-export bridge。
- 不使用 scoped slot、双向 model 或动态 tag。
- React-backed 小程序组件只通过 `Slot` 声明默认插槽。
- 若 `usingComponents` 缺失、tag 不一致或选择 dynamic mode，让编译直接失败并修正契约，不加运行时兜底。
