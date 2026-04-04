# Wevu Runtime Perf Matrix

## `setData`

当前关注点：

- 是否高频整对象回写
- 是否启用 `autoSetDataPick`
- 是否需要 `setData.strategy: 'diff' | 'patch'`
- 是否应启用 `suspendWhenHidden`

## 渲染

当前关注点：

- 是否在 `onPageScroll` 中放了重逻辑
- 是否可以改成 `useIntersectionObserver`
- 动画是否优先平台动画或 CSS

## 页面切换

当前关注点：

- `onHide/onUnload` 是否阻塞
- 页面切换窗口期是否做了多余清理或请求
- 是否该结合分包和预取策略一起看

## 资源与内存

当前关注点：

- 图片尺寸是否明显大于展示尺寸
- 缓存、监听、定时器是否在卸载时清理
- 内存告警后是否有统一释放路径
