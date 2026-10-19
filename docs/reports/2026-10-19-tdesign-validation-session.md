# TDesign 聚合会话局部验证

2026-10-19，四组 `template-wevu-tdesign-regression` 场景通过一个 fixture owner 共用一次构建和受管 session。真实微信开发者工具完成 **8 个用例、29 个 checkpoint**，全部通过；每个 case 仍按原路由 `reLaunch`、恢复初始状态并独立收集日志。

这是一轮有筛选的局部回归。正式 exhaustive 计划包含 140 个适用 task，本轮执行 1 个，其余 139 个未执行；另有 3 个非适用 task。报告保持 `coverage: partial`、`acceptance: incomplete`，suite 退出码为 1。它不代表正式全量 IDE 验收，也不进入性能成功样本。

## 场景和环境

| 逻辑组 | 用例数 |
| --- | ---: |
| class/style binding | 1 |
| form | 1 |
| layout feedback dialog | 3 |
| runtime errors | 3 |

官方查询来源为 [微信开发者工具渠道元数据](https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json)，查询时间 `2026-10-19T11:58:52.459Z`。官方 Stable、所选安装和实际连接宿主均为 `2.02.2608080`，实际基础库为 `3.17.4`；没有版本例外。Node 为 `v24.18.0`。

启动日志保留了同一窗口的通用 `simulator launch failed` 诊断及随后对应的 `webview page ready`。没有关闭重开窗口、改换安装或追加测试重试；原启动预算内就绪后执行了全部原有断言。

本轮记录了机器租约取得、预检、构建、启动、连接、首屏条件等待、case、checkpoint、项目清理和宿主退出阶段。case 事件在 reporter 中可能延迟派发，现以 Vitest 的实际诊断时间计时；修正后已重新完成 8 个用例、29 个 checkpoint，记录与实际用例耗时一致。task 耗时 65.689 秒，但本轮不作为正式计时采样。

## headless 和 simulator 对应覆盖

三个 provider-compatible 子文件共 7 个用例通过，覆盖 form、layout feedback dialog 和 runtime errors。class/style 场景需要真实布局和 computed style；logical headless 明确拒绝该能力，未删减真实 IDE 断言，也未把该限制改写为通过。

对应的 simulator unit 2 项、headless Chromium browser 1 项通过，覆盖五种状态及十个 style probe。browser 用例通过实际 DevicePreview/workbench 交互检查 class 替换、颜色、边框、透明度、CSS 变量、可见尺寸及 page identity。当前 simulator 不提供 rpx 计算布局的完整等价能力，字体和圆角等原计算样式断言继续由真实 IDE 验证。

## 复现与资源

先构建相关包和 fixture，核对官方 Stable、登录与服务端口，再串行执行：

```sh
node --import tsx scripts/check-e2e-ide-shared-launch.ts
env WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless node --import tsx e2e/scripts/run-e2e-commands.ts pnpm exec vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.form.test.ts e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test.ts e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test.ts --maxWorkers=1 --no-file-parallelism
env WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST=1 node --import tsx e2e/scripts/run-e2e-suite.ts ide-full:exhaustive --filter=template-wevu-tdesign-regression.aggregate
```

真实运行通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 显式固定本机核验过的 CLI。macOS 长任务外层使用 `caffeinate -dimsu`。场景复用既有 fixture，没有新增页面或 AppID 配置。

task 完成受管项目清理并通过同一 CLI 正常 `quit`。额外领域核验于 `2026-10-19T12:02:55.042Z` 确认宿主为 cold，并从完整进程清单检查 1,329 个可执行进程，所选安装残留进程为 0。没有终止其他任务或手动实例，没有保留本任务窗口、浏览器页或测试会话。

原始 DOM、suite、warning、官方版本及退出证据保存在本地 ignored `.tmp`，公开记录不包含本机路径。合并后仍须在与 `origin/main` 一致的干净主工作树完成正式全量 IDE 验收；CI 与 IDE 的同范围三轮性能对比尚未完成。
