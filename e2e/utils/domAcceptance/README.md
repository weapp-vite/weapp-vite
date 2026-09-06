# 检查点预期错误

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

DevTools 与 headless 配置都初始化事件日志。连接后 console 和 exception 使用共享采集器；清空 automator 内存日志不会删除事件日志。headless 的启动拒绝与 DevTools 的最终启动失败会保留异常信息。目前 simulator 的公开 launch 在返回 session 前完成 bootstrap，因此成功 bootstrap 中已发出的 console 仍需 simulator 提供启动前订阅入口；真实 IDE 在 automator 连接前也存在协议订阅边界，不能以连接后的空日志证明启动期间无错误。
