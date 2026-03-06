# WeChat Runtime Perf Matrix (for weapp-vite / wevu)

## 1) `setData`（runtime_setData）

当前已具备：

- `wevu` 支持 `setData.strategy: 'diff' | 'patch'`。
- 支持 `pick/omit/includeComputed` 与 `autoSetDataPick`（weapp-vite 编译期注入）。
- 支持 `highFrequencyWarning`（含 `onPageScroll` 专项告警）。
- 支持 `suspendWhenHidden`（后台态合并下发）。

仍可补强：

- 提供 `setUpdatePerformanceListener` 的 wevu 友好封装与示例。
- 提供编译期/诊断期规则：识别 `this.setData(this.data)`、高频整对象回写。

## 2) 渲染（runtime_render）

当前已具备：

- `useIntersectionObserver()` 并自动在卸载时 `disconnect`。
- Weapp-vite 自动注入页面事件 `features.enableOnXxx`（含 `onPageScroll`）。
- `onPageScroll + setData` 运行时专项告警。

仍可补强：

- 模板复杂度分析（节点数/深度）并输出阈值告警。
- 静态检查空 `onPageScroll` 与滚动回调中的重逻辑模式。

## 3) 页面切换（runtime_nav）

当前已具备：

- 分包与共享策略治理（`hoist/duplicate`）。
- 推荐 `lazyCodeLoading: "requiredComponents"` 的文档与实践。
- `weapp-vite analyze` 可辅助定位跨包共享与体积映射。

仍可补强：

- 增加 `handleWebviewPreload` 的策略化指导模板（static/auto/manual）。
- 提供页面切换链路标准采样模板（route/firstRender 对照）。

## 4) 资源加载（runtime_resource）

当前已具备：

- 完整构建链路可接入图片处理插件。
- 组件类型系统覆盖 `image` 常见模式（含 `widthFix/heightFix`）。

仍可补强：

- CLI 级资源体积扫描（超阈值图片、尺寸与展示尺寸不匹配）。
- 对 `widthFix/heightFix` 滥用场景输出构建告警。

## 5) 内存（runtime_memory）

当前已具备：

- `onMemoryWarning()` 生命周期支持。
- `effectScope/onScopeDispose` 与卸载清理机制。
- `suspendWhenHidden` 减少后台态无效更新资源争用。

仍可补强：

- 提供标准化副作用清理辅助（timer/listener/request disposer）。
- 增加性能回归模板：内存告警触发后的自动采样与日志归档。
