# @wevu/query

## 0.0.1

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @wevu/web-apis@1.2.42
  - wevu@7.1.1

## 0.0.0

### Minor Changes

- 新增独立的 `@wevu/query` 服务端状态管理包，提供类型关联查询键、共享请求与缓存、失效刷新、作用域隔离、mutation、分页查询，以及 Wevu 响应式和页面生命周期接入。应用前后台与网络状态通过显式微信宿主适配器驱动，不内置持久化或自动重试策略。

  为 simulator 增加应用显示/隐藏监听和显式测试控制，并支持在执行小程序入口前等待 `configureSession` 配置完成。查询回归通过仅限指定回环源与查询路径的测试传输访问真实 HTTP 服务，默认 request mock 和 strict mock 策略保持不变。

  应用事件分发对齐真实微信开发者工具：保留同一监听器的重复注册，按事件快照处理派发期间的增删，取消监听时移除全部同引用注册；冷启动保持 App 显示钩子先执行，后续恢复与隐藏则先执行 wx 监听器。

  自定义 `HeadlessWxDriver` 实现需要补齐 `onAppShow`、`offAppShow`、`onAppHide`、`offAppHide` 四个方法；内置 Node 与 browser driver 已同步迁移。

  Web runtime 同步支持 `wx.onAppShow`、`wx.offAppShow`、`wx.onAppHide`、`wx.offAppHide`，保持相同的监听快照、重复注册与回调顺序。浏览器隐藏事件向 wx 监听器与 App 钩子传递同一份 `{ reason: 3 }`，表示无法区分微信退出来源的“其他”原因；同时修正公开类型入口，使其指向实际生成的 `.d.mts` 声明文件。

### Patch Changes

- Updated dependencies:
  - @wevu/web-apis@1.2.41
  - wevu@7.1.0
