# PR #1086：TDesign 启动对照与验收限制

当前产品提交为 `bad3afc8702b6606f6de8fd861d0c305f487d2a7`。真实 IDE 的 TDesign 颜色更新场景尚未完成首屏与 DOM 验收。以下都是临时诊断，不能计入正式通过项；产品源码、模板和正式 suite 已恢复，`weapp-vite` 已重新构建。

后续[直接 IDE CLI 与实际 SDK 对照](./issue1082-tdesign-direct-sdk.md)补充了观测：桌面已解锁；`wv open` 仍有 automator 健康检查，旧“普通 CLI”观察不能排除该交互。新直接 IDE CLI 项目也出现无响应，且实际 3.15.2 的全新项目仍未恢复首次启动。

## 对照与结果

入口为 `e2e/ide/template-tailwindcss-tdesign-hmr.runtime.test.ts` 的 `updates the visible Tailwind`。正式场景保留原颜色、主题切换和 HMR 断言，同一 suite 复用一次 automator 会话，通过原页面就绪检查取得首页；本轮没有新增页面或修改正式 AppID/页面条件。

| 临时变化 | 结果 | 可支持的结论 |
| --- | --- | --- |
| 仅去掉 `wevu/api` 导入，改用原生 `wx` | 启动 90 秒超时，0 DOM | 该对照没有恢复首屏 |
| 仅去掉直接 ActionSheet 脚本导入，保留模板组件 | 启动 90 秒超时，0 DOM | 该对照没有恢复首屏 |
| 注册包装从 `original.call(globalThis, nativeDefinition)` 改成直接调用 | 启动 90 秒超时，0 DOM | 未证明接收者是启动失败原因 |
| 仅移除 `componentFramework` | 启动 90 秒超时，0 DOM | 未证明 glass-easel 配置是唯一原因 |
| 仅移除 `lazyCodeLoading` | 日志订阅成功，随后页面预热超时，0 DOM | 启动推进到更晚阶段，但未完成首屏；实际日志为 `LazyCodeLoading: false` |
| 无 lazy 配置并临时跳过预热，读取全局状态 | 用例失败，0/5 DOM | `getApp({ allowDefault: true })` 返回值不能证明应用已初始化 |
| 上项改用普通 `getApp`，同时读取原生 `wx` | 用例失败，0/5 DOM；`appAvailable: false` | 所读上下文没有应用/bridge/client 标记，尚不能定位具体失败脚本 |
| 仅移除客户端末尾的初始 `send('register')` | 启动 90 秒超时，0 DOM；桌面锁定导致 UI 不可读 | 未观察到恢复，不能据此排除网络因素或认定根因 |

最后一项的实际运行时间为 2026-09-27 05:35:55.306–05:37:39.194 UTC。Computer Use 返回 Mac 已锁定且无法自动解锁；没有通过其他入口绕过锁屏。日志中的 2 skipped 是 beforeAll 失败后的用例未运行，不是主动跳过失败断言。

## 其他观察及限制

- 正常 CLI 打开保留产物时，曾在开发进程停止后看到 TDesign 首屏出现。缓存、打开顺序和观察时间均不同，不能据此判定停服或 HMR 网络活动是因果。禁用注册仅为检验这一假设，没有进入正式代码。
- engine build 探针明确关闭 CLI fallback，返回 IDE 未提供该接口。它不证明模板编译成功或失败。
- 之前普通 IDE 窗口实际观察到 SDK 3.17.3；配置声明的 3.13.2/3.15.0 不等于实际加载版本。3.15.2 对照未取得有效 runtime 观测，不作版本因果结论。
- 全局探针没有可靠确认目标应用执行上下文，不把空 `appCodeKeys` 或缺少 bridge 标记写成“应用脚本肯定未执行”。
- 所有临时改动均已恢复。没有修改安装 IDE、产物写入方式、正式轮询、超时或验收断言；没有把跳过预热作为修复。

## 证据与复核

[完整脱敏归档](./issue1082-tdesign-startup-controls.json.gz) 包含八项诊断的完整日志、DOM 报告、临时 suite 差异、原件 SHA256、engine 接口失败及恢复构建日志。解压 1427445 字节，SHA256：`edcc9357bb8d4d7a052ddb40c7043f1bfeb7948ad82e282d5339d90baa71e196`。

归档核验了 gzip 完整性、路径/AppID/邮箱/回环端口脱敏；源码恢复与已提交 HEAD 逐字节一致。诊断源码不进入正式构建交付，无 changeset 或脚手架版本变更；本次为 `docs` 证据更新。

恢复后最小运行入口仍为原 DevTools 配置及原场景过滤，需桌面可操作且全机没有其他 E2E/watch 后才能启动。当前结果未满足真实 runtime 与 headless 对齐条件；PR #1086 保持草稿，Issue #1082 保持开放。
