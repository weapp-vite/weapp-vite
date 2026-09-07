---
'@wevu/query': minor
'@mpcore/simulator': minor
---

新增独立的 `@wevu/query` 服务端状态管理包，提供类型关联查询键、共享请求与缓存、失效刷新、作用域隔离、mutation、分页查询，以及 Wevu 响应式和页面生命周期接入。应用前后台与网络状态通过显式微信宿主适配器驱动，不依赖 Pinia，不内置持久化或自动重试策略。

为 simulator 增加应用显示/隐藏监听和显式测试控制，并支持在执行小程序入口前等待 `configureSession` 配置完成。查询回归通过仅限指定回环源与查询路径的测试传输访问真实 HTTP 服务，默认 request mock 和 strict mock 策略保持不变。

自定义 `HeadlessWxDriver` 实现需要补齐 `onAppShow`、`offAppShow`、`onAppHide`、`offAppHide` 四个方法；内置 Node 与 browser driver 已同步迁移。
