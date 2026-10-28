# 小程序流式能力探针

本探针关联 #448，承接 #1031 的 Body/Blob 契约。2026-09-16 的第一阶段只验证了原生网络分块；2026-10-28 的实现进一步为 `@wevu/web-apis` 增加 Fetch 响应流、Web Streams、UTF-8 增量解码和 EventSource。`Blob.stream()` 和流式请求上传仍不在支持范围内。

能力探针、兼容层实现和真实客户端验收是不同的证据。以下分别记录历史观测、当前实现和本轮执行状态；headless 成功不能替代真实开发者工具或真机验收。

## 历史原生观测：2026-09-16

本节仅描述当时的运行记录，不代表当前 Stable 的能力。历史环境为微信开发者工具 2.02.2609142、AppService 基础库 3.17.2、webview renderer。宿主返回 platform=devtools、version=8.0.5、system=iOS 10.0.1；这些是模拟器环境信息，不是真机系统证明。

独立 fixture `e2e-apps/stream-capability-probe` 显式关闭 `appPrelude.webRuntime`；原生探针页 `/pages/index/index` 不导入 Web API ponyfill，直接调用 `wx.request`，结果与 headless 使用同一页面、同一 suite 对照。SSE suite 使用独立的 `weapp-vite.sse.config.ts`，通过正式 `appPrelude.webRuntime` 自动注入兼容层；两种配置分别构建，原生能力探针不受 SSE 安装器影响。headless 的宿主版本信息不作为微信版本证据。

| 能力                           | 历史宿主观测                                    | 当时结论                                         |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------ |
| RequestTask headers/chunk 监听 | 可用；headers 先于数据块到达                    | 可用于后续传输桥接                               |
| 网络增量交付                   | 服务端尚未结束响应时，页面已显示首块            | 有真实网络增量能力                               |
| 单个监听解绑、全部 chunk 解绑  | 解绑后不再调用；其他回调继续工作                | 已覆盖                                           |
| 分块请求成功结果               | `success.data` 是空字符串，即使指定 arraybuffer | 必须从 chunk 累积或消费，不能再读取 success.data |
| 首块前/后取消                  | `fail → complete`，错误为 `request:fail abort`  | 取消要绑定到底层 RequestTask；不保证远端立即断开 |
| 连接中断                       | 已到达字节保留，然后 `fail → complete`          | 必须传播错误，不得当作正常 EOF                   |
| 原生 TextDecoder 增量解码      | 拆分 UTF-8 字节后可正确还原中文                 | 本次宿主可用；兼容层仍需独立支持                 |
| 原生 ReadableStream            | 缺失                                            | 标准 Response.body 需要独立 Streams 实现         |
| 原生 Blob / Blob.stream        | Blob 缺失                                       | 不能依赖宿主提供 Blob.stream                     |

历史记录中，首块前取消后，真实 DevTools 在至少 10 秒观察窗口内仍可能保持服务端连接打开；继续发送并结束响应后，页面没有收到晚到 chunk、success 或第二次 complete。headless 回环传输使用 AbortController，会更早关闭连接。两者对齐的是页面可见的终止契约，不声称底层连接回收时机一致。

正常分块的观测顺序为 `headers → chunk… → success → complete`；空响应没有 chunk。测试不把服务器写入次数等同于 chunk 回调次数，不对精确延迟或错误文本中的宿主内部细节做契约断言。

上述历史探针没有检查 `onHeadersReceived` 是否携带真实 `statusCode`。因此，历史记录只能证明分块传输存在，不能单独证明标准 Fetch 可以在响应结束前返回真实状态码。

## 本次实现架构

### 共享传输与标准 Body

`packages-runtime/web-apis/src/fetch/transport.ts` 统一持有一次 `RequestTask` 的响应头、chunk、成功、失败和取消状态。项目级 `networkDefaults.request.enableChunked: true` 开启 Fetch 网络增量交付；普通请求继续使用缓冲模式。分块模式固定使用 `responseType: 'arraybuffer'`，字节来源是 chunk 回调，不依赖可能为空的 `success.data`。

收到真实 HTTP 状态码和响应头后，Fetch 即返回 `Response`，后续数据写入 `Response.body`。完成、失败和取消共用一个终止状态，收尾时解除监听；Response 返回后的网络错误进入 body 流，`AbortSignal` 继续有效，reader 取消也会传递到底层请求。

`text()`、`json()`、`arrayBuffer()`、`bytes()` 和 `blob()` 消费同一个 body。`bodyUsed`、流锁定与 `clone()/tee()` 共享消费语义：仅获取 reader 会锁定 body，开始读取或取消后才标记已消费；已锁定或已消费的 body 不能再次消费或 clone。clone 的两个分支分别消费，取消一个分支不立即取消另一个分支。

### Streams 与 UTF-8

`@wevu/web-apis/streams` 采用固定版本 `web-streams-polyfill@4.3.0` ponyfill。可用的原生 `ReadableStream`、`WritableStream`、`TransformStream` 作为一组保留；否则一致地使用 ponyfill，避免混合构造器造成品牌检查失败。

UTF-8 `TextDecoderPolyfill` 和 `TextDecoderStreamPolyfill` 保存跨块状态，处理中文、emoji、BOM、非法字节、fatal 模式及最终 flush。Fetch 本身只交付字节；解码与 SSE 解析分别位于上层。

### EventSource 与注入

`@wevu/web-apis/eventsource` 的 EventSource 基于相同 Fetch 传输，自动开启分块。独立解析状态机处理任意 chunk 边界、CR/LF/CRLF、多行 `data`、注释、命名事件、`id`、空 ID 重置和 `retry`。客户端提供 GET 订阅、事件监听、自动重连和 `Last-Event-ID`；204、无效状态或无效响应类型终止订阅。

EventSource 保持标准 GET 接口。POST 与自定义鉴权头使用 Fetch，Fetch 不自动重试，避免重复提交。首版不模拟浏览器 Cookie/CORS，`withCredentials: true` 明确报告 `NotSupportedError`。

`wevu/fetch` 复用本包实现。`weapp-vite` 扩展 `appPrelude.webRuntime` 的目标、依赖展开与局部绑定，识别 `eventsource-parser/stream`。构造器必须在第三方模块求值前可用：该解析器会在模块初始化时继承全局 `TransformStream`，仅在业务函数执行前安装还不够。Wevu 页面应在同步 setup 阶段注册 `onUnload`，由其 `abort()` 或 `close()` 清理活动请求。

## 严格宿主能力策略

流式请求必须具备 `RequestTask` 响应头和 chunk 监听，且在响应结束前拿到真实 `statusCode`。缺少监听、响应头没有有效状态码、首块先于有效响应头，或者直到请求结束仍未收到有效响应头时，流式 Fetch 明确以 `NotSupportedError` 失败。不能把最终 `success.statusCode` 冒充为早期元数据，不假定 HTTP 200，也不悄悄等待完整响应来模拟增量交付。

EventSource 遇到同样的能力错误时触发 error 并永久关闭，不进入无休止重连。普通缓冲 Fetch 不受此严格流式要求影响。headless 可以显式省略早期状态码，验证兼容层确实拒绝该宿主能力组合。

宿主提供的是 push 回调，目前没有已验证的暂停接收接口。标准 JS 流可以控制消费与排队，但不承诺网络级反压，也不通过静默丢块限制内存。慢消费者、长期打开的连接和不读取的 clone 分支都可能增加内存占用；本轮没有给出内存峰值保证。小程序域名白名单、TLS、超时和后台运行限制仍由宿主管理。

## 探针怎样区分增量交付与缓冲

独立 HTTP 服务绑定动态回环端口，每个请求在测试端放行前保持响应打开。测试先只发送 `[0, 65, 228]`，等待页面确认首块内容，并确认服务端没有结束响应，再发送余下字节或中断连接。完整有效载荷包含零字节、中文、emoji 和 `255`，逐字节校验最终内容。中文和 emoji 的 UTF-8 序列分别跨相邻发送阶段拆开。

覆盖正常、空响应、首块前取消、首块后取消、连接中断、解绑全部 chunk 监听和同会话重复请求。每个网络场景有初始、首阶段、终止状态的 DOM 验收。

headless 仅在目标 suite 挂接受限回环传输，使用网络 reader 每次到达的数据触发 chunk。它不会先调用完整 `arrayBuffer()` 再切片。simulator 默认仍只使用 mock：`chunks: [{ data, delay? }]` 的 delay 相对于前一阶段，`error` 可模拟分块后的失败；没有显式 chunks 时不会把普通 response 拆成假分块。`headersStatusCode: null` 可模拟只有 headers、缺少早期状态码的宿主。

本轮原生 suite 新增 200、204、401、429、500 五种状态。服务端只 flush 响应头并保持响应未结束，页面分别记录早期状态和最终 `success.statusCode`。早期状态缺失时记录 null，不将其改写为最终状态。

SSE suite 复用实际 `eventsource-parser/stream` 的 `pipeThrough(...).getReader()` 链路。正路径要求服务端保持响应打开时页面已显示首条消息，同时校验 POST 鉴权、EventSource 断线重连与 `Last-Event-ID`、页面卸载取消及晚到数据。能力缺失时走明确拒绝的分支，不能把该分支通过写成正路径通过。

## 本轮验证状态：2026-10-28

| 验证对象 | 当前证据 | 适用范围 |
| --- | --- | --- |
| headless 原生探针 | 隔离构建后 13/13 通过；200、204、401、429、500 均在响应结束前提供对应状态码 | simulator 回环宿主与原生 fixture 契约 |
| headless SSE | 隔离构建后 5/5 通过；真实 parser 在响应未结束时收到中文和 emoji；POST 鉴权、重连 ID、卸载取消和缺少状态码均通过 | 完整兼容层的正路径及拒绝路径 |
| simulator 浏览器 | Chromium headless 3/3 通过；早期状态缺失、429、增量字节和取消顺序符合断言 | 浏览器中 simulator 的分块契约 |
| 当前 Stable SSE | 正式自动注入构建的 4 项真实客户端用例通过，无运行时错误；缺少状态码的第 5 项仅适用 headless | 实际首条消息在响应结束前显示，POST 鉴权、重连 ID 与卸载取消成立 |
| 当前 Stable 原生探针 | 前轮 13 项断言通过，真实早期 200/204/401/429/500 均与请求一致；最终隔离构建复验因模拟器冷启动超时，13 项未执行 | 前轮存在另一个已注册 SSE 页面初始化错误，严格整组未通过；不能把本轮所有真实 IDE 验收记为成功 |
| 微信真机及最低目标基础库 | 未测试 | 不声明与 DevTools 或 headless 等价 |

真实连接宿主为本机已安装 Stable 2.02.2608080、基础库 3.17.5。官方元数据在本轮查询为 Stable 2.02.2609240；依本地安装选择策略使用前者，没有换版。两版并不相同，不能将已安装版本当作官方最新版本。

前期 headless 暴露了第三方 parser 在安装器之前求值的问题；真实 DevTools 进一步发现，仅手动安装全局对象仍会被微信模块包装器的局部 `fetch` 参数遮蔽。当前 SSE fixture 直接导入真实 parser，并使用正式编译注入配置，不再保留手动安装 facade。编译回归在压缩前后均用带 `fetch` 参数的模块包装器执行真实产物：手动安装负例保持失败，自动注入正例验证 POST 鉴权、跨字节中文和 emoji、响应结束前输出及卸载取消。

微信还会在启动时执行已注册页面脚本。最初原生配置误包含 SSE 页面，在缺少 `TransformStream` 的环境触发初始化错误，严格 DOM 门禁正确拒绝该轮结果。当前默认配置关闭自动路由，只输出原生页；SSE 配置通过正式自动路由精确注册两页。6 项编译回归包含执行全部注册页的检查，两个 runtime suite 同时断言实际 `app.json` 和页面文件，保留严格 DOM 门禁。

最终真实复验中，原生窗口仍报通用 `simulator launch failed`，在原启动预算内未就绪，日志订阅超时；没有追加导航、重开窗口重试或将未执行项计为通过。Computer Use 已读取真实项目窗口及模拟器错误。SSE 窗口的 4 项用例随后成功，单独不能抹去原生套件失败；最终命令整体失败，全面真实 IDE 验收未完成。

官方 CLI `quit` 在一轮清理中出现 `initialize → IDE server has started → quit`，其后仍有同安装的新宿主，退出核验拒绝释放。最终由真实持有关闭权和机器租约的外层 runner 管理：先确认受管窗口、端口和 journal 释放，再通过原生应用正常退出，核验整份安装进程清单。退出过渡期残留也被保留为原始错误，随后通过精确租约恢复和领域核验完成清理，没有强杀、删除全局缓存或降低所有权门禁。此结果不代表官方 CLI 自动退出路径已通过。

`@wevu/web-apis` 完整单测 197/197、公开类型与包类型检查通过；Wevu 原有宿主及全局安装回归 16/16、相关基础设施回归 94 项和三平台 vendor 构建 3 项通过。原生流探测和 Body 追踪共用一次安全构造器快照，覆盖没有 `globalThis`、缺少 `AbortSignal` 时原生惰性 getter 抛错，以及正常原生 Body 消费。

## 当前入口的体积比较

2026-10-28 使用 Node 24.22.1、Rolldown 1.2.15、`web-streams-polyfill` 4.3.0 与 `eventsource-parser` 3.1.1，先重建包，再以 CJS、minify、tree shaking、无 external 和无 sourcemap 打包。统计所有 emitted JS 原始字节；gzip level 9 按文件压缩后求和。每项产出一个 JS 文件。

| 消费入口 | JS 字节 | gzip 字节 |
| --- | ---: | ---: |
| 普通缓冲 Fetch + `.text()` | 147,477 | 35,728 |
| Fetch 流 + TextDecoderStream + 第三方 SSE parser | 151,873 | 37,370 |
| EventSource + `onmessage` + `close()` | 154,179 | 38,052 |
| 原生 `wx.request` 调用参考 | 165 | 155 |

以上是当前实现不同公开子入口的比较，未包含根安装器或应用 prelude，也不是旧版与新版的体积差。普通 Fetch 已包含 Streams、URL 与动态 API adapter 等共同成本，原生调用参考不具备 Web Body 或 SSE 语义，其差额不能解释为纯 SSE 成本。

可从仓库根目录复现，JSON 报告保留依赖版本、构建选项、文件哈希和模块清单：

```sh
pnpm --filter @wevu/web-apis build
node packages-runtime/web-apis/scripts/measure-streaming-bundles.mjs --include-native
```

默认报告位于 `.tmp/streaming-bundle-size`，可用 `--out-dir` 指定其他证据目录；bundle 均由 Rolldown 原生 write 写出。

## 复现与验证

先安装依赖、重建受影响包，所有 E2E 串行运行。两个 suite 均检查页面 JS/JSON/WXML 存在和真实 AppID。执行前核对官方最新 Stable，并通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 选择对应安装；真实 IDE 需登录并开启服务端口。连接、登录或桥接失败属于验收环境失败，不能写成能力不支持。

```sh
pnpm --filter weapp-vite... build
pnpm --filter @mpcore/simulator... build
node --import tsx scripts/check-e2e-ide-shared-launch.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm exec vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/stream-capability.runtime.test.ts e2e/ide/sse-stream.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 caffeinate -dimsu -- pnpm exec vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/stream-capability.runtime.test.ts e2e/ide/sse-stream.runtime.test.ts
```

日志中的 `stream-probe-capabilities`、`stream-probe-http-status` 和 `stream-probe-result` 保留能力状态、环境、事件顺序、字节和终止结果。`sse-runtime-capability` 记录原生早期状态是否可用；`sse-fetch-success.successPathExecuted` 仅在实际消息断言完成后记录正路径已执行。DOM 报告由仓库现有 reporter 生成。方法缺失、调用失败、业务验证失败和环境失败应分别保留证据。
