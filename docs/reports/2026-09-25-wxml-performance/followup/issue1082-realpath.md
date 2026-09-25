# Issue #1082：同步路径解析复用后的诊断与正确性验证

## 结论边界

产品修复见 [PR #1085](https://github.com/weapp-vite/weapp-vite/pull/1085)，被测源码提交 `b7a461c5a0a2fd6fc8654b1db3ff916bdaca7b59`。复用范围限定在一次同步模块图遍历或分块决策，成功路径复用、失败保留重试，退出同步调用即释放；没有跨事件、构建或异步续体缓存。

🔴 **正式性能验收仍未完成。** 本轮为带 CPU profiler 的单次诊断，不是三平台 7/20 对及一次等量确认。四个场景各两次编辑/恢复均满足正常 CLI 的产物和完整恢复断言；App JSON 首次编辑的 compiler total 为 **530.426583ms**，超过未改动的 500ms 诊断预算，进程返回 1。不能把“没有正确性失败”改写成整轮预算通过，也没有调预算或重复采样求绿。

## 重复工作的证据

修复前诊断见 [#1083 的记录](https://github.com/weapp-vite/weapp-vite/blob/e6ada63fe7093beec4e3deec893f900df64ff4ff/docs/reports/2026-09-25-wxml-performance/followup/issue1082-diagnosis.md)。两次独立会话均使用原生 classic、四场景、两轮编辑/恢复及相同轮询/稳定等待；机器仍有编辑器服务，不能当作无竞争负载的正式比较。

| 指标 | 修复前诊断 | 修复后诊断 |
| --- | ---: | ---: |
| `realpath` 自身 CPU 采样累计 | 2026.24ms | 1532.33ms |
| 整段 CPU profile 时长 | 11170.12ms | 10276.54ms |

该累计包含启动阶段；不能把上述差值当作任一 HMR 阶段的收益、历史 PR 回退增量或 5% 门禁结论。`resolveRealpath` / `withRealpathScope` 新增自身 CPU 采样分别为约 11.54ms / 2.62ms，也保留在原始 profile 中。

确定性回归提供另一种证据：同一物理文件同时具有普通、query、逻辑入口、侧车模块及侧车来源 ID 时，一次遍历原先触发 10 次 native realpath，修复后 1 次，返回的完整节点集合相同。下一次遍历仍重新解析。测试另覆盖嵌套/异常释放、失败后创建、junction 替换、异步续体不保留、dev 图节点增删及配置服务参与的分块决策。

## 本轮逐次端到端数据

以下全部为诊断 wall time，不采用中位数相减推断监听、编译或发布成本。详细阶段、事件 ID、编辑与恢复记录保留在 [JSON](./issue1082-realpath-after.json.gz)，CPU 节点、样本及时间间隔保留在 [CPU profile](./issue1082-realpath-after.cpu.json.gz)。

| 场景 | 轮次 | 编辑 wall / ms | 恢复 wall / ms |
| --- | ---: | ---: | ---: |
| app-json | 1 | 572.93 | 234.29 |
| app-json | 2 | 318.09 | 337.24 |
| native-page-script | 1 | 265.96 | 371.13 |
| native-page-script | 2 | 293.07 | 346.33 |
| native-page-template | 1 | 286.18 | 365.64 |
| native-page-template | 2 | 419.92 | 339.38 |
| native-page-style | 1 | 419.50 | 368.86 |
| native-page-style | 2 | 391.86 | 367.85 |

## 正确性与运行时

- 11 个产品定向测试文件累计 72 例通过；weapp-vite typecheck、test:types、build 通过。
- WXML provider suite：headless 2 例、真实 DevTools 2 例串行通过；native / Vue 的生成路径、文件存在性、转换后属性、DOM 结构与事件结果一致。
- classic HMR suite：headless 1 例、真实 DevTools 1 例串行通过。先经真实 CLI 更新产物，再重新进入页面，断言新 marker、新增量逻辑、实例/输入/计数状态重置与 query 保留。
- 该 classic suite 原先假设所有 provider 都支持 `disconnect()`，首次 headless 尝试在该接口处失败。现明确对 headless 调用既有 `close()` 释放旧 runtime，对 DevTools 保留 `disconnect()`；没有新增公开 API 或放宽状态断言。simulator 对应会话关闭/新产物启动/状态隔离测试及其原有测试共 9 例通过，包级 typecheck 通过。
- 另一次旧 `wevu-runtime.core-hmr` headless 尝试在 DOM 计划校验处失败：它要求布局/计算样式观察，headless logical node 不支持。未进入目标 runtime，保留该限制，未修改其断言或冒充通过。
- IDE 共享启动检查通过（138 文件）。验证前确认外部项目的 E2E 已结束，各 CLI/IDE/headless 命令串行执行。

## 数据保全

仅将本机目录字符串替换为占位符；保留计时数字、节点编号、样本顺序、时间间隔、错误与预算结论。gzip 解压 JSON 与脱敏对象逐项一致；CPU `samples` 与 `timeDeltas` 和原始记录完全相同。

| 归档 | 原始字节 SHA256 | 脱敏 JSON SHA256 |
| --- | --- | --- |
| `issue1082-realpath-after.json.gz` | `618c474f76bdc50f23eaecd5f6cbb87199e794c543e3832591ba6adba10f35b9` | `8a8f8b609ab8dcfc47b0e6c4772540bbc76a5fa85d0110ee03d7ae406cdfb0e7` |
| `issue1082-realpath-after.cpu.json.gz` | `ec175c939a9c770391a47a2d86c6cdd78b9ddfc5a7b273449b69f4dd81df86ee` | `87833e974057f47c2d3b733e91bb7f6dd72eb21989807d520f1c1e398f37ea5c` |

## 未解决事项

### Web CI 网络基础设施修正

产品提交 `b7a461c5a` 的 [Web E2E Baseline](https://github.com/weapp-vite/weapp-vite/actions/runs/36176611878/job/108208643794) 在 macOS / Node 24.20.0 下有 11 文件、83 条断言通过，但另有未捕获的 `setTypeOfService EINVAL`，检查仍为失败。堆栈进入 Node 内置 Undici 的 `writeH1`；该版本仍无条件调用 socket QoS 方法，与 [Undici #5544](https://github.com/nodejs/undici/issues/5544) 一致。

独立 TCP 复现只创建本地临时端口，接受连接后立即 `resetAndDestroy()`，再循环调用 `fetch`。本机 Node 24.18.0 即使逐次 `try/catch` 仍因同一未捕获异常退出；复现不加载产品源码。改用新增 HTTP 就绪探针后，同样 2000 次连接重置全部通过 Promise 拒绝，进程正常结束。没有补丁修改全局 Socket 或忽略未捕获异常。

四处 Web 启动检查统一用 Node HTTP/HTTPS 短连接探针：保留 GET、成功状态码与重定向语义，单次总期限最多 2 秒且不超过外层启动剩余时间，收到响应头后释放响应和连接；网络错误交由原有启动重试处理。不会改变浏览器页面、视觉或事件断言，也不修改 HMR 采样计时。

- 就绪探针与服务器 URL 定向测试 14 例通过，覆盖状态码、30 次连接重置、拒绝连接、无响应、重定向上限及释放未结束响应体；新增两文件严格依赖闭包类型检查通过。
- 原失败的 uView Plus 组件库及 Web demo / visual 三文件共 22 例通过；Firefox/WebKit 冒烟另 2 例串行通过。未更改视觉基线。
- scoped ESLint 通过。此修正属于测试基础设施，无产品 API 或额外 changeset；新提交的 GitHub 检查仍需实际完成。

### 性能与发布生命周期

固定基线 `e7862e61dd83e3b9e356ac1e176267b31ab298af` 保持不变。历史回退、不稳定、基线 sitemap 缺陷与独立包生命周期不可比较项继续保留。main Nightly `36172401898` 测的是合并后的 main `d657d7b64bf2e5fb367862377255d513dab0ec07`，不包含本次优化，不能据其结果判断 #1085 的收益。

stateful 混合临时文件事件导致完整重建的复现仍成立，本次没有实现文件事件过滤，也未证明该现象与所有发布超时或 #1081 同因。原生 DevEngine 的无 watcher 内存构建探针已验证：buildStart/load/transform/generateBundle 都可以登记不在模块图内的 `addWatchFile` 依赖；模块图成员关系不能替代完整监听归属。后续方案还须覆盖 native builtin 依赖及独立快照、自定义 compiler、WXML、copy/public 与目录拓扑。
