---
title: HMR 与历史 IDE 回归映射
description: 保留历史 IDE 失败 case 的观测表面与回归入口，区分 HMR 分层验收和完整 IDE 验收。
---

# HMR 与历史 IDE 回归映射

本表对应提交 `8bffd07722919743cffd7522900c0b5640d4bc7c`、运行 `a319a7ef-05d6-4639-ac8c-374f43ecb997` 的历史审计。该轮执行 365 个 case，339 个通过、26 个失败，另有 16 个跳过；严格验收失败。这些数字不代表当前提交的结果。

表中的“失败观测”保留原报告可证明的表面现象，不能据此断定产品、宿主或协议根因。HMR 入口继续覆盖其中 18 个失败 case 所属的语义场景；另外 8 个 case 仍由原完整 IDE 任务验收。新的 classic 回退机制不自动证明这些历史失败已修复。

原始 case ID 与 task 文件共同标识历史记录。当前 case 名称或实现调整后，仍须保留原有功能主路径、关键边界、DOM checkpoint 和完整 IDE 入口；不能用新命令的零退出码代替逐项回归结果。

三个 Wevu 编译模板场景现由 `hmr-compiled-template-fallback.runtime.test.ts` 验收编译模板注册边界、classic 刷新后的默认状态、计算和事件、后续保存及源码恢复。映射保留原始 task 与 case ID，另行记录当前回归 task；原生 Component 独立 WXML 的模板循环仍由原 stateful 场景覆盖。这些映射均为覆盖计划，实际结果取决于对应提交的运行报告。

| 历史 task | 历史 case ID | 失败观测 | 回归入口 |
| --- | --- | --- | --- |
| `issue-1015-css-hmr.runtime.test.ts` | `1630232160_0_0` | classic CSS HMR 样式对象不相等。 | HMR：`native-css-and-tailwind` |
| `issue-1015-css-hmr.runtime.test.ts` | `1630232160_1_0` | stateful CSS HMR 样式对象不相等。 | HMR：`native-css-and-tailwind` |
| `issue-1065-provider.runtime.test.ts` | `1873779161_0_1` | provider 连续更新后仍红色，预期蓝色。 | HMR：`compiler-provider-and-tailwind-transactions` |
| `issue-1072-json-context.runtime.test.ts` | `-1030164228_0_0` | reLaunch 根节点超时，原报告不足以区分查询/协议/渲染或产品路径。 | 完整 IDE：原任务保留 |
| `issue-1081-tailwind-batch.runtime.test.ts` | `-890224961_0_0` | Tailwind batch 背景透明，预期浅蓝。 | HMR：`compiler-provider-and-tailwind-transactions` |
| `issue-1081-tailwind-snapshot.runtime.test.ts` | `148571157_0_0` | snapshot 生成/页面 class 交集布尔断言为 false。 | HMR：`compiler-provider-and-tailwind-transactions` |
| `issue-1081-transaction.runtime.test.ts` | `-255098768_0_0` | transaction 最新背景透明，预期浅绿。 | HMR：`compiler-provider-and-tailwind-transactions` |
| `issue-1126-1128.test.ts` | `521111092_0_2` | 1127.native-primary 根节点超时；不能仅据此归因产品或宿主。 | 完整 IDE：原任务保留 |
| `issue-1126-1128.test.ts` | `521111092_0_3` | 原生边界后续调用连接已关闭。 | 完整 IDE：原任务保留 |
| `issue-1126-1128.test.ts` | `521111092_0_4` | 原生主路径后续调用连接已关闭。 | 完整 IDE：原任务保留 |
| `issue-1126-1128.test.ts` | `521111092_0_5` | 原生边界后续调用连接已关闭。 | 完整 IDE：原任务保留 |
| `issue-1140-mode-cache.runtime.test.ts` | `1272146000_1_0` | mode-cache empty-false step0 封装错误、缺实际版本；report 的 boot 首错属于另一个 passed case，不能移用归因。 | 完整 IDE：原任务保留 |
| `issue-998-tailwind.runtime.test.ts` | `-677312916_0_0` | ordinary CSS 后点击计数0，预期1。 | HMR：`native-css-and-tailwind` |
| `layout-power-demo.runtime-vendor-hmr.test.ts` | `-1112925670_0_0` | runtime vendor 方法调用后的 AppService 与原生页面状态不等。 | HMR：`shared-host-framework-adapters` |
| `mcp-runtime-tools.runtime.test.ts` | `1497806994_0_0` | MCP 原生组件方法调用报 this.mark is not a function。 | 完整 IDE：原任务保留 |
| `script-setup-external-src.runtime.test.ts` | `957257009_0_0` | 外部 src 改动后 reLaunch 根节点超时，根因未证。 | HMR：`app-shell-and-external-source` |
| `shared-taro-hmr.runtime.test.ts` | `1608988755_0_1` | Taro 新 utility 背景透明，预期紫色。 | HMR：`shared-host-framework-adapters` |
| `stateful-hmr.runtime.test.ts` | `51224417_0_3` | stateful .sfc-template 缺失。 | HMR：`compiled-template-registration-fallback` |
| `stateful-hmr.runtime.test.ts` | `51224417_0_7` | stateful .derived-count 缺失。 | HMR：`compiled-template-registration-fallback` |
| `stateful-hmr.runtime.test.ts` | `51224417_0_9` | component page template cycle 节点缺失。 | HMR：`native-wevu-state-and-template-boundaries` |
| `stateful-hmr.runtime.test.ts` | `51224417_0_10` | wevu page template cycle 节点缺失。 | HMR：`compiled-template-registration-fallback` |
| `template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts` | `-1550806590_0_0` | TDesign HMR 活跃节点属性保留旧 f6f7fb，预期 dbeafe。 | HMR：`tailwind-template-registration-and-local-priority` |
| `wevu-jsx-tsx.hmr.runtime.test.ts` | `-1954556557_0_0` | TSX 更新文本节点缺失。 | HMR：`jsx-and-sibling-script-updates` |
| `wevu-runtime.core-hmr.test.ts` | `-1850694854_0_0` | core SFC HMR probe marker 保留旧值。 | HMR：`wevu-page-layout-and-wxs` |
| `wevu-runtime.pruning.test.ts` | `253079654_0_0` | pruning 分包 reLaunch 根节点超时，根因未证。 | 完整 IDE：原任务保留 |
| `wevu-runtime.shared-template-wxs.hmr.test.ts` | `-2089383673_0_0` | shared template/WXS 后活跃路由发生非预期变化。 | HMR：`wevu-page-layout-and-wxs` |

`pnpm e2e:hmr:acceptance` 只汇总同一干净提交的构建、headless 与真实 IDE HMR 分层结果。完整 IDE 验收继续执行 `pnpm e2e:ide:full:exhaustive`，包含本表全部原任务及新的 capability fallback 场景。完整 suite 未通过前，不能将 HMR 分层通过表述为历史 26 个失败全部解决。

覆盖定义与命令说明见[开发态 HMR 配置](./hmr.md#独立-hmr-回归命令)。
