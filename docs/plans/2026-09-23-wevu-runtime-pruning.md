---
title: wevu 按平台与使用能力裁剪运行时
date: 2026-09-23
status: implemented
---

# wevu 按平台与使用能力裁剪运行时

关联 [Issue #1064](https://github.com/weapp-vite/weapp-vite/issues/1064)。本轮覆盖微信、支付宝、抖音、百度、京东、小红书六个小程序平台与 Web，使已知构建目标和未使用能力可以在最终打包时裁剪，并为公共 `wevu` 具名导入保留独立测量。

## 设计与兼容边界

- 平台：编译期 `import.meta.env.PLATFORM` 直接决定当前宿主访问和注册路径。支付宝组件注册与未知宿主探测分离，静态目标无需保留其他宿主适配。未注入目标的平台继续使用通用探测 fallback。
- 包边界：`@weapp-core/shared/platforms/runtime` 只提供运行时需要的描述和帮助函数，避免带入构建配置、完整平台注册表和 API 注册。该入口不注入 Node shim；发布包继续保留可二次裁剪的模块边界。
- 发布语法：wevu 中间产物使用 ES2020 保留静态环境表达式，避免在应用定义替换之前降低 optional chaining、破坏平台裁剪。最终消费打包器按目标平台降级；本次体积测量统一使用 ES2018。
- 能力：router 安装时才接入首屏导航实现；核心生命周期只保留通知桥。JSX island 由编译结果声明并导入，普通内部 provider 页面不包含 JSX handler。
- 公共动态工厂：`createApp`、`createWevuComponent` 仍保守保留原有 patch、scoped slots、template refs 与 JSX 等动态兼容能力；公共入口不使用 router 时无需保留首屏 router 实现。不把 compiler 内部阶梯的裁剪条件错误应用到公共动态工厂。
- App：本轮不增加原生 App renderer 或虚构平台 ID。复用 Web runtime 的容器沿用 Web 结果；独立 App 宿主需要实际 adapter 和对应消费场景后再加入矩阵。

## 同口径体积结果

基线为 `cc1b76dab7f3`；当前列为 #1064 实现的已重建发布产物。两侧使用同一份 v4 harness、锁定依赖和 Node 24，分别解析各自包目录。测量生产压缩后的实际字节；Web 另记录 level 9 gzip。当前工作树尚未提交时，JSON 中的 commit 仍是起点提交，因此不能仅凭该字段将两份产物视为同一源码状态。

基线六个小程序各阶梯数值相同，表中合并展示：

| 阶梯 | 六个小程序基线 / B | Web 基线 / B |
| --- | ---: | ---: |
| 响应式核心 | 6,570 | 6,570 |
| 最小应用 | 81,822 | 185,670 |
| 典型页面 | 137,010 | 455,469 |
| 复杂组件 | 151,662 | 465,728 |
| 公共入口最小应用 | 171,726 | 275,664 |
| 公共入口典型页面 | 173,651 | 492,039 |
| 完整 Provider | 267,599 | 611,445 |

当前 production 字节：

| 平台 | 响应式核心 | 最小应用 | 典型页面 | 复杂组件 | 公共最小应用 | 公共典型页面 | 完整 Provider |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 微信小程序 | 6,560 | 75,768 | 118,848 | 133,427 | 154,235 | 156,151 | 252,747 |
| 支付宝小程序 | 6,560 | 75,789 | 120,878 | 135,457 | 156,265 | 158,181 | 254,777 |
| 抖音小程序 | 6,560 | 75,928 | 119,008 | 133,587 | 154,395 | 156,311 | 252,907 |
| 百度小程序 | 6,560 | 75,774 | 118,854 | 133,433 | 154,241 | 156,157 | 252,753 |
| 京东小程序 | 6,560 | 75,768 | 118,848 | 133,427 | 154,235 | 156,151 | 252,747 |
| 小红书小程序 | 6,560 | 75,771 | 118,851 | 133,430 | 154,238 | 156,154 | 252,750 |
| Web | 6,560 | 177,495 | 435,156 | 445,350 | 256,062 | 472,400 | 594,473 |

主要变化（production）：

| 平台与阶梯 | 基线 / B | 当前 / B | 减少 / B | 降幅 |
| --- | ---: | ---: | ---: | ---: |
| 微信小程序 / 最小应用 | 81,822 | 75,768 | 6,054 | 7.40% |
| 微信小程序 / 典型页面 | 137,010 | 118,848 | 18,162 | 13.26% |
| 微信小程序 / 公共入口最小应用 | 171,726 | 154,235 | 17,491 | 10.19% |
| 微信小程序 / 公共入口典型页面 | 173,651 | 156,151 | 17,500 | 10.08% |
| 微信小程序 / 完整 Provider | 267,599 | 252,747 | 14,852 | 5.55% |
| 支付宝小程序 / 典型页面 | 137,010 | 120,878 | 16,132 | 11.77% |
| Web / 公共入口最小应用 | 275,664 | 256,062 | 19,602 | 7.11% |
| Web / 公共入口典型页面 | 492,039 | 472,400 | 19,639 | 3.99% |
| Web / 完整 Provider | 611,445 | 594,473 | 16,972 | 2.78% |

Web gzip 字节：

| 阶梯 | 基线 / B | 当前 / B |
| --- | ---: | ---: |
| 响应式核心 | 2,660 | 2,653 |
| 最小应用 | 55,105 | 52,468 |
| 典型页面 | 141,848 | 135,660 |
| 复杂组件 | 144,960 | 138,778 |
| 公共入口最小应用 | 80,600 | 75,840 |
| 公共入口典型页面 | 151,776 | 147,304 |
| 完整 Provider | 184,873 | 179,783 |

## 门禁与报告协议

- 体积矩阵固定为 7 个目标 × 7 个阶梯，同时测 development 与 production。完整 Provider 使用 namespace 导入测能力上限；其余使用具名导入。Web 最小应用保留 app 注册桥，典型页面及以上保留组件注册桥。
- 原微信最小应用、典型页面、完整 Provider 预算分别保持 93,535 B、160,182 B、271,282 B。本轮新增其余 46 个 production 预算，按上表正式实测值 `ceil(bytes * 105 / 100)` 固定，后续测量不会自动更新基线。
- 矩阵缺失、重复目标或阶梯、非法字节、非法 gzip、无 entry 的模块图均失败。单个平台打包失败不能写成零体积或跳过。
- 保留模块按 `bytesInOutput > 0` 判断；零贡献 barrel 不误报。全部阶梯禁止 shared 完整平台注册表和构建元数据，允许独立 runtime 描述；已知目标禁止通用平台 fallback；非支付宝禁止支付宝注册实现；非完整阶梯禁止 router 首屏实现、`@weapp-core/api` 与 fetch 实现，允许 Web 调度辅助；普通内部阶梯禁止 JSX handler。原内部阶梯 deny rules 保持，失败诊断提供从入口到违规模块的引用链。
- 全量报告使用 v4，包含 7×7 测量与模块引用链。CI 同时输出 v2 的微信/Web 原五阶梯投影，让主线旧版可信评论脚本可以读取。现有 Actions artifact `wevu-runtime-size-report` 保留原始测量、v2 `report.json`、v4 `report-full.json` 和 `report.md`，维持评论下载入口；另上传独立 Actions artifact `wevu-runtime-size-report-full`，仅包含 v4 `report-full.json` 与完整矩阵 `report.md`。升级后的读端兼容 v2/v3/v4，并优先读取完整 v4；job summary 始终展示完整矩阵。
- 带写权限的评论 workflow 继续只执行默认分支脚本，不执行 PR head 代码。报告先保存再执行体积门禁，失败时仍能下载诊断 artifact；artifact 缺失也失败。

## 复现与验收

分别在 baseline/head checkout 中安装锁定依赖并构建发布包，随后从 head checkout 使用相同 harness：

```sh
pnpm --filter '@weapp-vite/web...' build
pnpm exec tsx scripts/report-wevu-runtime-size.ts --root=../baseline --output-json=.tmp/runtime-size/baseline.json
pnpm exec tsx scripts/report-wevu-runtime-size.ts --root=. --baseline-json=.tmp/runtime-size/baseline.json --output-json=.tmp/runtime-size/head.json --output-markdown=.tmp/runtime-size/report.md --check
pnpm vitest run -c scripts/vitest.config.mjs scripts/runtime-size.test.ts scripts/runtime-size-guard.test.ts scripts/runtime-size-platform.test.ts scripts/report-wevu-runtime-size.test.ts scripts/upsert-runtime-size-comment.test.ts scripts/performance-comment.test.ts scripts/performance-comment-workflow.test.ts
```

本次七平台完整测量与结构门禁已通过。测试覆盖旧协议兼容、完整报告优先、矩阵缺项、模块引用链、公共动态工厂边界及可信 workflow。体积结果只证明最终产物裁剪；响应式、生命周期、router 和 JSX 的功能验收由对应 fixture、headless 与真实 DevTools runtime suite 独立完成，不用体积或构建通过替代真实宿主行为。

本地 runtime 验收记录：

| 场景 | headless | 真实微信 DevTools |
| --- | ---: | ---: |
| 普通 SFC、响应式子组件、分包重启、公开动态工厂 JSX 点击 | 2 通过 | 2 通过 |
| JSX/TSX、动态 island、跨组件事件、setup render | 3 通过 | 3 通过 |
| router 允许、重定向、终止、后续导航、超时、拒绝与卸载后返回 | 7 通过 | 7 通过 |
| App router 首屏身份、命名跳转、返回与重新启动 | 1 通过 | 1 通过 |

真实 IDE 为 Stable 2.02.2608070；新 fixture 与 router 使用基础库 3.17.2。JSX suite 的 bridge 刷新连接失败后，经 Computer Use 确认实际点击与子组件事件正常，使用现有 `WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE=direct` 完成全部原断言，基础库为 3.17.3。分包只有 `text` 根节点，fixture 显式配置共有的 `text` 就绪节点，继续保留各页面精确 selector、生命周期和 DOM 断言。

单独运行 router suite 时，需要设置 `WEAPP_VITE_E2E_TARGET_FILE=ide/github-issues.runtime.issue911.test.ts` 或对应的 `issue1035` 文件，使冷启动 fixture 使用各自的路由范围。所有 repository E2E 按串行顺序执行，下游验证前已重建受影响发布包。
