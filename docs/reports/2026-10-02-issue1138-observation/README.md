# #1138 setData 阶段观测验收

本轮提供可选 prepare、物理 dispatch 和 commit 观测，保留既有 revision 与等待语义。这里只验收 #1138；#1137 的发布包消费者普通/performance 配置比较仍未完成。

## 源码与证据身份

样本的 `source` 保存 Wevu 源码、锁文件、采样脚本 SHA-256；`runtime.json` 保存本轮严格报告的基线提交、dirty 状态与原始报告摘要哈希。本轮候选为合并 Web 批次后的提交 `451056b65cd06d238bdb0de6828a59912e67a31d`，运行时报告记录该候选的干净工作区。合并前仍须在候选 HEAD 检查 CI 和运行时。

## 实际运行时

同一 suite 共享 automator，通过 `reLaunch` 切换原生 callback 与延迟 Promise 页面，并检查两个页面的 JS/JSON/WXML 共六个产物。真实 AppID 与 IDE 条件页已同步。

- headless：严格模式，2/2 场景、5/5 DOM checkpoint，通过。
- DevTools：严格模式，2/2 场景、5/5 DOM checkpoint，通过；实际 IDE `2.02.2608080`、基础库 `3.17.2`。
- 原生 callback 场景检查初始、方法更新及点击后的 `count: 0/1/2`，并关联三阶段、revision 和物理字节。
- 延迟 Promise 场景确认 JS 队列已排空、原生 callback 已完成、DOM 为 `count: 1`，此时没有 commit；释放 Promise 后才记录 commit。可见文本与适配器完成分别取证。
- 单测覆盖 throw/rejection、晚到旧 revision、乱序、连续失败恢复、dispose、缓冲合并、整轮采样、诊断异常隔离及关闭观测的热路径。

官方查询时间 `2026-10-02T05:23:39Z`：下载页与渠道配置均确认 Stable `2.02.2608080`（渠道日期 2026-09-30）。来源为 <https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html> 与 <https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json>。显式选择该版本 CLI，未使用 RC/nightly。连接阶段一次 Tool.getInfo 超时后正常重试成功，目标 runtime 没有 warn/error/exception。测试只断开自己的 automator，会话外 IDE 宿主保留；不进行全局进程清理。

复现时先重建 wevu 和 weapp-vite，再以 `WEAPP_VITE_E2E_DOM_ACCEPTANCE=1`、`WEAPP_VITE_E2E_TARGET_FILE=ide/github-issues.runtime.issue1138.test.ts` 运行对应 provider 的配置。真实侧额外设置 `WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER=1` 和所选 Stable 的 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH`。

```sh
pnpm exec vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/github-issues.runtime.issue1138.test.ts
pnpm exec vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/github-issues.runtime.issue1138.test.ts
```

以上两条必须串行，分别设置 `WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless` / `devtools`。mpcore 配套同一 fixture 的 unit 与真实浏览器用例均通过。

## 观测开关成本

使用 Node 源码适配器，12 轮交错关闭/开启，共 96 个原始样本。每个样本预热 30 次、测量 200 次更新；列表含 1000 项。每个样本的真实适配器调用均为 200 次。外层计时使用 Node performance.now，阶段计时使用 runtime Date.now；开销包含 JSON 字节统计与收集回调。

| 策略 / 输入 | 关闭耗时中位数（ms） | 开启耗时中位数（ms） | 每轮配对差中位数（ms） |
| --- | --- | --- | --- |
| diff / scalar | 59.585 | 62.000 | 3.323 |
| diff / list | 79.109 | 93.436 | 12.675 |
| patch / scalar | 29.713 | 31.056 | 2.675 |
| patch / list | 177.098 | 209.439 | 57.018 |

列表路径的观测成本明显高于标量。样本波动与自然 GC 保留在 `samples.json`；不能从一次 heap/RSS 差值判断泄漏，也不能外推为真机渲染成本或 performance preset 的收益。关闭时阶段/字节记录为 null，无法观测的边界保持未知；同步 adapter 的 completion 为 return，visibleAt 始终为 null。

复现命令：

```sh
node --expose-gc --import tsx packages-runtime/wevu/scripts/benchmark-setdata-observation.ts artifacts/setdata-observation.json
```

## 局部验证

Wevu 全包 109 文件 / 1267 测试、包级 typecheck、公开类型测试通过；simulator unit/browser/typecheck、suite manifest 42 项、website build 和 scoped ESLint 通过。中文 changeset 包含 wevu minor 与 create-weapp-vite patch。

新增观测逻辑独立放入 observation 模块。超过 300 行的 commitTracker 和 runtimeInstance 继续持有各自账本/原生适配器状态，不为行数拆散提交状态机；关闭观测不新增 payload 复制、JSON 序列化或计时。
