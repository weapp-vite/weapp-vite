# DOM 检查点

节点默认使用当前页面的 CSS 查询。检查自定义 tabbar 等独立渲染根时，显式登记 `query: 'xpath'`，由 `page.getElementsByXpath` 查询真实渲染树，再读取节点文本、属性或布局。XPath 的层级和后代关系必须写在表达式中，不能与 CSS 的 `scope`、`has` 混用。

```ts
const tabbarNode = {
  query: 'xpath',
  selector: '//*[contains(@class, "issue-380-custom-tab-bar")]',
  text: 'issue-380 custom tab bar',
}
```

两种查询都禁用 AppService fallback，并在证据中记录 `query`。provider 缺少 XPath 能力、查询异常或表达式失败不能被计为节点不存在；只有成功返回空集合才满足 `count: 0`。

每次采集都读取当前页面并核对路由和只读 `pageId`，完成查询后再次核对。HMR 或同路由重建导致身份变化时，丢弃本次证据并重试；缺少真实页面身份时失败。headless 的身份绑定底层页面实例，重新创建测试 handle 不改变身份。调用方传入的旧 handle 只用于核对预期路由，不能作为当前界面的证据来源。

## HMR 操作来源

真实 IDE 热更新后，`getCurrentPages()` 返回的 AppService 路由对象可能仍持有旧方法，而原生 `Page.callMethod` 已执行更新后的页面定义。需要验证当前原生页面行为的 HMR 操作应读取 `currentPage({ appFunctionFallback: false })`，并调用 `callMethodWithOptions(method, { fallback: false })`，使协议失败直接暴露。`routeOnly: true` 明确选择 AppService 路由对象，不能替代原生页面身份验收。

方法返回值只用于诊断执行来源；操作后的文本、节点和布局仍须由 DOM 检查点独立验证，不能通过重新加载页面掩盖旧实例问题。

## 预期错误

预期错误必须在测试开始时与检查点一起登记。只接受精确的来源、级别、通道、文本和正整数次数，不接受正则、子串、全局 allowlist 或从本次日志反向生成期望。

```ts
const acceptance = createDomAcceptance(context, 'e2e-apps/example', [{
  id: 'rejected',
  route: 'pages/request/index',
  action: '提交无效请求',
  nodes: [{ selector: '.result', text: '请求已拒绝' }],
  expectedErrors: [{
    source: 'runtime',
    level: 'error',
    channel: 'runtime',
    text: 'request rejected',
    count: 1,
  }],
}])

await acceptance.act('rejected', async () => {
  await page.callMethod('submitInvalidRequest')
  await page.waitFor('.result')
})
await acceptance.check('rejected', miniProgram, page)
```

`act` 将操作写成同一事件日志中的开始和结束边界，并绑定当前 case 与 checkpoint。异步操作必须等待目标错误和结果完成后再返回；结束边界之后的错误不会被消费。每个 checkpoint 只能执行一次操作，禁止重放来消耗额外错误。

结构化 console 的 Error 属性查询可能晚于操作本身返回。`act` 在开始边界前刷新已收到的旧日志，并在结束边界前等待操作期间收到的日志完成属性检查；DOM `check` 前后和 case 结束也执行刷新。刷新只等待已经收到的事件，不能代替业务异步就绪条件。活跃会话只登记在当前 invocation 的 worker 内，关闭或断开时释放；多个会话全部完成后才跨越边界，失败会写入 `console-inspection` 通道并使测试失败。

严格报告同时复核 DOM 证据与错误消费。少报、多报、文本不符、其他 case 的错误、作用域缺失、操作未结束都不能通过。错误日志始终保留在 `runtimeDiagnostics`，预期错误只改变验收分类，不删除证据。

DevTools 与 headless 配置都初始化事件日志。连接后 console 和 exception 使用共享采集器；清空 automator 内存日志不会删除事件日志。headless 在 `onSessionCreated` 中先订阅再执行 bootstrap，启动拒绝与 DevTools 的最终启动失败也会保留异常信息。

IDE wrapper 仅从完整构建产物创建隔离快照，连接前完成复制并固定 `miniprogramRoot`。开发进程通过 `waitForInitialBuild()` 等待 CLI 的初次构建完成信号，单个输出文件出现不能代替该信号。连接后直接订阅真实应用日志并检查实际页面，不再生成占位页、连接后覆盖应用或清空启动 Console；持续文件同步只镜像构建器已写出的产物。

报告路径只来自当前运行的完整环境变量集合，子进程通过环境继承同一集合；未初始化报告的独立进程不能读取或追加其他运行的日志。辅助单测必须 mock 日志接口或使用逐 case 临时报告目录，不能沿用外部传入的真实验收报告；辅助单测和真实 E2E 也必须串行执行。

`dev -o` 等共享开发进程从输出监听开始，将明确的 `[mini:<level>]` 转发日志以及 `[warn]`、`[error]`、Consola 严重级别前缀写入事件日志，分别记录为 `runtime/forward-console` 和 `build/dev-process`。普通日志中出现 `Error` 单词不会改变其严重级别；空 error/exception 载荷仍保留为错误。`waitForOpenedAutomator` 在连接后立即订阅统一日志，并等待 `enableLog` 握手成功后才检查页面就绪；订阅失败必须重试或拒绝，失败连接的监听器会清理。

`launchAutomator` 等待 `enableLog` 成功后才执行页面刷新与预热；握手失败由启动错误路径记录并清理连接，不能当作空日志通过。日志收集先通过被动监听接口挂载 console 与 exception，再由启动流程显式发起唯一的限时订阅，避免 SDK 的 `on('console')` 隐式请求抢占超时预算，同时保留订阅期间的启动日志。post-connect refresh 与 compile 仍属于同次启动，不自动重置会话日志或错误计数；显式 `resetAutomatorRuntimeLogs` 仅供调用者主动划分诊断窗口，且不会删除持久事件日志。

需要镜像开发构建产物再启动 IDE 的场景先调用 `devProcess.waitForInitialBuild()`，等待 CLI 在 Vite 初次构建完成后发出的完成信号。部分 WXML、WXSS 或 app.json 已写入不能证明整次构建已结束，过早镜像会把后续初次写入变成 IDE 的额外热重载。

禁止 `reLaunch` 的冷启动验收使用完整就绪预算；300ms 快速探测只用于允许随后切页的场景。每次读取当前页面使用 `currentPage({ retries: 1, timeout, pageStackFallback: false, appFunctionFallback: false })`，由外层就绪循环统一重试，避免 SDK 内部延迟与回退请求超出单次探针期限。元数据短暂缺失可以继续探测，协议无响应和最终就绪超时仍然失败。

真实 IDE 在 automator 连接前仍有协议订阅边界。开发进程转发只能补充 CLI 已收到的日志；宿主日志扫描只覆盖其明确识别的启动异常，不能替代 Console 的完整历史。不能以连接后的空日志证明启动期间无错误，IDE 中尚未诊断的错误仍须通过 Computer Use 读取并记录。来自开发进程和协议事件的证据使用不同通道，不能静默删除或合并以满足预期错误次数。

严格 DevTools 报告要求每个已执行 case 都保留 `Tool.getInfo` 的实际 IDE 与基础库版本，各 case、检查点及报告环境摘要必须一致。配置文件中的 `libVersion` 不作为实际版本的后备值，headless 不伪造宿主版本。

诊断事件由生产者写入 `recordedAt`，journal 另记 `collectedAt`；`observedAt` 保留为生产者时间的兼容别名。旧事件可以读取和展示，但缺少真实发生时间时不能通过严格验收。

`startup-protocol` 仅记录 warmup 中已识别的 `App.getCurrentPage` 元数据暂态和协议超时：每次失败保留原始消息与尝试序号，实际页面节点就绪后记录 `recovered`；退出时未就绪则记录 `unresolved` error。它不等同于业务 AppService console/exception，恢复事件不删除、重置或消费任何业务异常。该诊断数量是启动轮询观察到的请求失败数，不宣称等于 IDE Console 的聚合错误数。
