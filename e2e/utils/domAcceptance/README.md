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

严格报告同时复核 DOM 证据与错误消费。少报、多报、文本不符、其他 case 的错误、作用域缺失、操作未结束都不能通过。错误日志始终保留在 `runtimeDiagnostics`，预期错误只改变验收分类，不删除证据。

DevTools 与 headless 配置都初始化事件日志。连接后 console 和 exception 使用共享采集器；清空 automator 内存日志不会删除事件日志。headless 在 `onSessionCreated` 中先订阅再执行 bootstrap，启动拒绝与 DevTools 的最终启动失败也会保留异常信息。

报告路径只来自当前运行的完整环境变量集合，子进程通过环境继承同一集合；未初始化报告的独立进程不能读取或追加其他运行的日志。辅助单测必须 mock 日志接口或使用逐 case 临时报告目录，不能沿用外部传入的真实验收报告；辅助单测和真实 E2E 也必须串行执行。

`dev -o` 等共享开发进程从输出监听开始，将明确的 `[mini:<level>]` 转发日志以及 `[warn]`、`[error]`、Consola 严重级别前缀写入事件日志，分别记录为 `runtime/forward-console` 和 `build/dev-process`。普通日志中出现 `Error` 单词不会改变其严重级别；空 error/exception 载荷仍保留为错误。`waitForOpenedAutomator` 在连接后立即订阅统一日志，并等待 `enableLog` 握手成功后才检查页面就绪；订阅失败必须重试或拒绝，失败连接的监听器会清理。

`launchAutomator` 同样等待 `enableLog` 成功后才激活 bridge wrapper 的目标应用或执行页面刷新与预热；握手失败由启动错误路径记录并清理连接，不能当作空日志通过。

真实 IDE 在 automator 连接前仍有协议订阅边界。开发进程转发只能补充 CLI 已收到的日志；宿主日志扫描只覆盖其明确识别的启动异常，不能替代 Console 的完整历史。不能以连接后的空日志证明启动期间无错误，IDE 中尚未诊断的错误仍须通过 Computer Use 读取并记录。来自开发进程和协议事件的证据使用不同通道，不能静默删除或合并以满足预期错误次数。
