# 小程序流式能力探针

本探针关联 #448，承接 #1031 的缓冲 Body/Blob 契约。它验证网络分块与宿主原生能力，没有为 `@wevu/web-apis` 新增 `Response.body`、`Blob.stream()` 或 SSE API。

## 实测环境与边界

2026-09-16，微信开发者工具 2.02.2609142，AppService 基础库 3.17.2，webview renderer。宿主返回 platform=devtools、version=8.0.5、system=iOS 10.0.1；这些是模拟器环境信息，不是真机系统证明。

独立 fixture `e2e-apps/stream-capability-probe` 显式关闭 `appPrelude.webRuntime`，不导入 Web API ponyfill。探针直接调用 `wx.request`，结果与 headless 使用同一页面、同一 suite 对照。headless 的宿主版本信息不作为微信版本证据。

| 能力                           | 当前宿主观测                                    | 结论                                             |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------ |
| RequestTask headers/chunk 监听 | 可用；headers 先于数据块到达                    | 可用于后续传输桥接                               |
| 网络增量交付                   | 服务端尚未结束响应时，页面已显示首块            | 有真实网络增量能力                               |
| 单个监听解绑、全部 chunk 解绑  | 解绑后不再调用；其他回调继续工作                | 已覆盖                                           |
| 分块请求成功结果               | `success.data` 是空字符串，即使指定 arraybuffer | 必须从 chunk 累积或消费，不能再读取 success.data |
| 首块前/后取消                  | `fail → complete`，错误为 `request:fail abort`  | 取消要绑定到底层 RequestTask；不保证远端立即断开 |
| 连接中断                       | 已到达字节保留，然后 `fail → complete`          | 必须传播错误，不得当作正常 EOF                   |
| 原生 TextDecoder 增量解码      | 拆分 UTF-8 字节后可正确还原中文                 | 本次宿主可用；兼容层仍需独立支持                 |
| 原生 ReadableStream            | 缺失                                            | 不能直接暴露标准 Response.body                   |
| 原生 Blob / Blob.stream        | Blob 缺失                                       | 不能依赖宿主提供 Blob.stream                     |

首块前取消后，真实 DevTools 在至少 10 秒观察窗口内仍可能保持服务端连接打开；继续发送并结束响应后，页面没有收到晚到 chunk、success 或第二次 complete。headless 回环传输使用 AbortController，会更早关闭连接。两者对齐的是页面可见的终止契约，不声称底层连接回收时机一致。

正常分块的观测顺序为 `headers → chunk… → success → complete`；空响应没有 chunk。测试不把服务器写入次数等同于 chunk 回调次数，不对精确延迟或错误文本中的宿主内部细节做契约断言。

## 如何证明不是缓冲后的分块

独立 HTTP 服务绑定动态回环端口，每个请求在测试端放行前保持响应打开。测试先只发送 `[0, 65, 228]`，等待页面确认首块内容，并确认服务端没有结束响应，再发送余下字节或中断连接。完整有效载荷包含零字节、中文、emoji 和 `255`，逐字节校验最终内容。中文和 emoji 的 UTF-8 序列分别跨相邻发送阶段拆开。

覆盖正常、空响应、首块前取消、首块后取消、连接中断、解绑全部 chunk 监听和同会话重复请求。每个网络场景有初始、首阶段、终止状态的 DOM 验收。

headless 仅在该 suite 挂接受限回环传输，使用网络 reader 每次到达的数据触发 chunk。它不会先调用完整 `arrayBuffer()` 再切片。simulator 默认仍只使用 mock：新增 `chunks: [{ data, delay? }]`，delay 相对于前一阶段，`error` 可模拟分块后的失败；没有显式 chunks 时不会把普通 response 拆成假分块。

## 复现与验证

先安装依赖、构建 CLI 及 simulator，所有 E2E 串行运行。suite 自动构建原生 fixture，并检查页面 JS/JSON/WXML 存在和真实 AppID。真实 IDE 需登录并开启服务端口。

```sh
pnpm --filter weapp-vite... build
pnpm --filter @mpcore/simulator... build
node --import tsx scripts/check-e2e-ide-shared-launch.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm exec vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/stream-capability.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 caffeinate -dimsu pnpm exec vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/stream-capability.runtime.test.ts
```

日志中的 `stream-probe-capabilities` 和 `stream-probe-result` 保留能力状态、环境、事件顺序、字节和终止结果。DOM 报告由仓库现有 reporter 生成。方法缺失和调用失败分别记录；连接、登录或桥接失败属于验收环境失败，不能写成能力不支持。

## 下一阶段的实现条件

- **Response.body**：网络事件具备桥接基础，但需要显式选取 Streams 兼容实现或设计独立的内部消费器。必须处理 headers 时机、空 success.data、error/close、abort/cancel 和 clone 分支所有权。
- **Blob.stream()**：可以研究不可变字节片段的按需读取；它属于内存数据读取，不能称为网络流式支持。
- **解码**：本包 `TextDecoderPolyfill` 当前没有增量状态，不能直接对任意网络块逐块 decode。后续应覆盖中文、emoji、BOM、尾部不完整字节、fatal 和 flush。
- **内存与反压**：宿主提供 push 回调，本次未验证暂停接收能力；应设计队列上限、慢消费者和 clone/tee 的缓冲策略。这里没有给出内存峰值或反压保证。
- **体积与平台**：本轮不引入 Streams 依赖，没有声称未来 Streams 实现零体积成本。选型时分别测 ponyfill、按需注入和无使用入口的产物大小，并补真机及目标最低基础库验证。
