# runtime-bench-vue

wevu Vue SFC benchmark 基准工程。

## 场景

- 首屏冷启动：`/pages/index/index`
- 页面切换：`/pages/detail/index`
- 高频更新 / 响应式提交：`/pages/update/index`
- 显式 patch 策略对照：`/pages/update-patch/index`

更新场景包括：整表替换、连续 40 次更新、小字段修改、同轮批量修改、追加 10 项、原地重排。每个场景先预热一次，再保留三个原始样本。normal 与 performance 使用相同输入和工作量，不预设提速或缩包比例。

## 命令

- `pnpm --filter runtime-bench-vue dev`
- `pnpm --filter runtime-bench-vue build`

发布包预设对照由仓库根目录执行。先重建全部受影响包，再打包一次完整 workspace 依赖闭包；两份临时消费者使用同一份 tarball，严格校验 engines、peer、安装锁文件及物理解析路径，不依赖源码 workspace 链接。

```sh
pnpm build:pkgs
node packages/weapp-vite/scripts/consumerTarballs.mjs .tmp/runtime-bench/tarballs
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm e2e:runtime-bench --published-presets --tarballs=.tmp/runtime-bench/tarballs --output=.tmp/runtime-bench/headless-presets.json
```

随后按仓库规范核实当轮官方最新 Stable 渠道、安装与实际连接宿主，设置 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH`，将 provider 改为 `devtools` 再执行同一命令。所有运行全局串行；真实 IDE 环境失败保留未完成状态。入口与直接 worker 都执行登录预检，不自行绕过登录或切换版本。

输出保留源码与归档哈希、安装闭包、安装耗时、消费者 automator 启动耗时、每个产物文件的实际字节、运行时系统信息，以及每个样本的调用数、载荷 UTF-8 字节、revision 阶段事件和 DOM 验证结果。消费者内部路径不会写入成功报告；消费者 CLI 从自身物理 `node_modules` 解析。失败时仍保存 `complete: false` 的报告，然后清理本次创建的临时消费者。

指标采用 schema 2，旧 checkpoint 自动失效：

- prepare：按 observer/revision 关联；dispatch、字节和 commit 按物理 `dispatch.id` 去重。
- commit：适配器 callback、Promise 或同步 return 的结算耗时；pending、失败或不可观测阶段为 `null`。
- `flushMs`：仅为 `nextTick` 调度等待；不代表宿主提交或可见渲染完成。旧 `firstCommitMs` 缺少提交观测，保留字段但值为 `null`。
- visible：通过 automator 单独核对最终汇总文本、卡片数及首项顺序，其 wall time 包含协议往返。运行时阶段的 `visibleAt` 仍为 `null`。
- memory：原始 `workerRssBefore/After` 仅属于采样 Node 进程。当前 automator 合约不提供宿主堆内存，`hostHeapBytes: null`、能力为 `unavailable`；不能把 worker RSS 当宿主内存或据此推断泄漏。
- 缺失或非法数值不会转换为 0；含未知样本的中位数及差值也为 `null`，真实测得的 0 仍保留。

历史 workspace 报告及源码 Node adapter 观测开销实验不能替代此发布包预设对照；旧报告中的 0 字节或以 `nextTick` 计算的 commit 时间不适合用于性能结论。基准代码和单测通过也不代表已经完成 headless 或真实 Stable 验收，最终结论需引用当轮原始报告。

定向脚本单测（不会启动 runtime/IDE）：

```sh
pnpm vitest run --config e2e/scripts/runtimeBench/vitest.config.ts
```
