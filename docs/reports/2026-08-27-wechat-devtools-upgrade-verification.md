# 微信开发者工具升级验收报告

## 验收结论

微信开发者工具升级至 `2.02.2608060` 后，仓库约定的 HMR 专项、单元测试、CI E2E 和 IDE full 门禁已在完成修复后的代码上全部通过。CLI open、automator 连接、页面切换、生命周期、控制台转发、截图、节点交互、子包路由、模板打开和 HMR 均有真实 DevTools 覆盖。

本次未执行 `e2e:ide:full:exhaustive`、组件库视觉全量和 headless full；这些范围不包含在本报告的通过结论中。

## 环境基线

| 项目 | 值 |
| --- | --- |
| 验收日期 | 2026-08-27 |
| 操作系统 | macOS 26.5.2 (`arm64`) |
| Node.js | 24.18.0 |
| pnpm | 11.22.0 |
| 微信开发者工具 | 2.02.2608060 |
| Electron bundle | 36.6.0 |
| DevTools buildTime | 1787647793927（2026-08-25T08:49:53.927Z） |
| DevTools 元数据布局 | `Contents/Resources/app.asar.unpacked/package.json` |

DevTools API surface 的当前快照见 `docs/reports/wechat-devtools-api-surface.md`。元数据解析同时兼容新版 `app.asar.unpacked/package.json`、旧版 `package.nw/package.json` 和直接传入的 `package.json`；新版路径优先，缺失时返回明确的未检测状态。

## 覆盖矩阵

| 范围 | 主要覆盖 | 结果 |
| --- | --- | --- |
| 元数据与 API 报告 | 新旧布局、直接文件、缺失路径、报告生成一致性 | 通过 |
| HMR regression | 原生 Page、Wevu setup、Component、TSX/island handler、Tailwind/TDesign 样式、连续后台更新、router subpath、dev-watch guards | 9/9 通过 |
| 单元与集成测试 | monorepo Vitest 全量 | 877 个文件通过，12 个文件跳过；7689 项通过，18 项跳过 |
| CI E2E | build/runtime、HMR guards、共享 chunk、模板与回归场景 | 71/71 通过 |
| IDE full | 登录与服务端口、CLI open、dev `-o`、automator、截图与节点交互、console forwarding、生命周期、子包路由、模板打开、runtime error 扫描 | 18/18 通过 |

## 最终命令结果

以下命令严格串行执行；DevTools/HMR 长任务由 macOS sleep inhibitor 保持运行，启动前后均清理残留 E2E、watch、automator 和 DevTools 会话。

| 命令 | 最终结果 | 耗时 |
| --- | --- | --- |
| `pnpm check:e2e-ide-shared-launch` | 通过 | 小于 1 秒 |
| `pnpm vitest run scripts/utils/wechatDevtoolsMetadata.test.ts` | 通过 | 小于 1 秒 |
| `pnpm report:wechat-devtools-api` | 通过，报告已刷新 | 小于 1 秒 |
| `pnpm check:wechat-devtools-api-report` | 通过 | 小于 1 秒 |
| `caffeinate -dimsu -- pnpm e2e:hmr:regression` | 9/9 通过；full guard 26/26、auto-import 3/3、shared chunks 3/3 | 聚合任务耗时 800.6 秒 |
| `pnpm test` | 877 个文件通过，12 个文件跳过；7689 项通过，18 项跳过 | 114.31 秒 |
| `pnpm e2e:ci` | 71/71 通过 | 聚合任务耗时 1017.7 秒 |
| `caffeinate -dimsu -- pnpm e2e:ide:full` | 18/18 通过 | 聚合任务耗时 1514.8 秒 |

`e2e:ide:full` 中 GitHub issues aggregate 为 62/62，通过耗时约 582.2 秒；模板批量 dev open 通过，耗时约 292.6 秒。所有已完成场景的 runtime error/exception 均为 0。

## 发现与修复

| 现象 | 根因 | 修复结论 |
| --- | --- | --- |
| API surface 仍读取旧版元数据目录 | DevTools 新版把产品元数据迁移到 `app.asar.unpacked/package.json` | 抽出可测试解析器并保留旧布局回退，报告已刷新至当前版本和 buildTime |
| TDesign 1.16.0 组件依赖出现裸 `export` 语法 | 压缩 ESM 中 `export*` 形式未被旧的空白敏感检测识别，桶文件没有完整转为 CommonJS | 使用语法级检测并补齐 `export *` 转换与回归测试；`weapp-vite` 和 `create-weapp-vite` 增加 patch changeset |
| deferred bridge wrapper 偶发读取到不完整或过期产物 | bootstrap 文件和真实运行产物共享根目录，连接后同步会与 DevTools 文件状态发生竞争 | 将 deferred runtime 放入独立 `miniprogramRoot`，同步完成后再交给 DevTools，避免覆盖 bootstrap 根目录 |
| 冷启动与页面切换偶发 readiness/reLaunch 失败 | 新版 DevTools 首次编译时间更长，且可能返回通用 `Uncaught [object Object]` 协议错误 | 冷编译使用独立 warmup 预算；对可恢复 reLaunch 错误做有界重试，并保持同一 suite 内共享 automator 会话 |
| IDE 任务之间可能继承编译缓存或残留进程 | suite 只清理进程，未在每项前统一清理 compile cache；旧清理逻辑串行执行大量 `pkill` | IDE suite 每项前清理残留进程和 compile cache；进程清理改为一次进程快照后只终止匹配 PID |
| DevTools 日志把已经恢复的 simulator launch 记为失败 | 日志扫描没有关联同一 simulator context 的后续成功事件 | 按 simulator context 识别恢复事件；其他 simulator 的成功不会掩盖真实失败 |
| HMR 用例可能在部分文件已写入时过早启动 | readiness 只等待单个 marker，不能证明完整小程序产物已可运行 | 等待 app、page、runtime、WXML、WXSS 和 HMR control payload 的稳定契约，再执行 runtime 断言 |
| QR 二进制 fixture 缺少稳定再生成入口 | fixture 只能手工替换，不利于复现测试资产 | 增加 `packages/qr` 的 fixture 生成脚本并刷新图片资产 |

## 运行时告警

验收中保留了真实 DevTools warning 信号，没有通过放宽 error/exception 断言来换取通过：

- CLI workflow 出现 1 条 `wx.getSystemInfoSync` 弃用 warning。
- React runtime 出现 1 条组件 property 类型 warning。
- Wevu feature/runtime 场景出现已有的属性类型、函数属性类型和无效 page.json 扩展字段 warning。
- 上述场景的 runtime error 和 exception 均为 0；GitHub issues aggregate 也没有 runtime warning/error/exception。

## 资产与复现

- DevTools 元数据解析和临时目录回归：`scripts/utils/wechatDevtoolsMetadata.ts`、`scripts/utils/wechatDevtoolsMetadata.test.ts`。
- 当前 API surface：`docs/reports/wechat-devtools-api-surface.md`。
- IDE/HMR 稳定性回归集中在 `e2e/utils`、`e2e/ide` 和 `e2e/ci`。
- QR fixture 可通过 `pnpm --filter @weapp-vite/qr fixtures:generate` 重新生成。
- 逐次 `docs/reports/<timestamp>-*-report/` 仅作为本地诊断产物，不纳入版本控制；本报告保留最终结果和可复现命令。
