# WeChat Runtime Perf Matrix

## `setData`

当前已具备：

- `setData.strategy: 'diff' | 'patch'`
- `pick/omit/includeComputed`
- `autoSetDataPick`
- `highFrequencyWarning`
- `suspendWhenHidden`

仍可补强：

- `setUpdatePerformanceListener` 的 wevu 友好封装
- 识别 `this.setData(this.data)` 与高频整对象回写的诊断规则

## 渲染

当前已具备：

- `useIntersectionObserver()` 自动清理
- `features.enableOnXxx` 页面事件注入
- `onPageScroll + setData` 专项告警

仍可补强：

- 模板复杂度分析
- 静态检查空 `onPageScroll` 与滚动回调重逻辑

## 页面切换

当前已具备：

- 分包与共享策略治理：`hoist/duplicate`
- `lazyCodeLoading: "requiredComponents"` 文档
- `weapp-vite analyze` 辅助体积定位

仍可补强：

- `handleWebviewPreload` 策略模板
- route / firstRender 标准采样模板

## 资源加载

当前已具备：

- 可接入图片处理插件
- 类型系统覆盖 `image` 常见模式

仍可补强：

- CLI 级资源体积扫描
- `widthFix/heightFix` 滥用告警

## 内存

当前已具备：

- `onMemoryWarning()`
- `effectScope/onScopeDispose`
- `suspendWhenHidden`

仍可补强：

- 副作用清理辅助
- 内存告警后的自动采样与日志归档模板
