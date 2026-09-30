# 本次迁移验证记录

来源快照：`weappjs/weapp-agent@a8a37d4a82c83c2701e36c09b2224462ec8d5514`。

以下记录只针对本次迁移。`source/VALIDATION.md` 是历史资料，不能作为迁移成功证据。

## 已验证

- 原有 65 项测试保留等价覆盖；额外覆盖新旧配置优先级、授权失效、跨 HTTP 请求任务持久化、运行租约、共享连接所有权、取消及 monorepo 子项目选择。
- 受影响包构建、typecheck、验收与 MCP 公开类型通过。
- 实际 tarball 安装验证独立 CLI、旧 verify、无模型验收、stdio MCP、报告读取、Skill 安装及拒绝覆盖；没有对旧仓库布局的依赖。
- 无模型包与 `wv accept --inspect` 在 Node 20.19.0、22.16.0、24.18.0 验证。检查使用抛异常的 Vite 配置，确认不求值工程配置。
- 网站构建、公开 Skills 同步、AGENTS 生成一致性、changeset 规则及 repoctl doctor 通过。
- 原生与 Wevu 的 provider-compatible headless 对照均通过：初始状态、点击更新、错误期望对照和重新进入页面。
- 原生与 Wevu 真实 DevTools：成功、故意断言失败、场景变更后重新授权、修复重跑均通过。

## 验证入口

```sh
pnpm --filter weapp-vite... --filter @weapp-agent/cli... -r build
node scripts/weapp-agent/create-fixtures.mjs
# 对生成的 native / wevu 工程分别设置 WEAPP_AGENT_ACCEPTANCE_FIXTURE，串行执行：
node scripts/weapp-agent/acceptance-devtools.mjs
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm exec vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/agent-acceptance.test.ts
node scripts/weapp-agent/smoke-pack.mjs
node scripts/weapp-agent/smoke-baseline.mjs
```

真实脚本要求已登录的微信开发者工具、服务端口和可用测试 AppID；fixture 创建器从现有 E2E 工程读取 AppID。测试输出保留在忽略目录 `artifacts/weapp-agent/`，不提交本地绝对路径与运行截图。自动化测试、DevTools 模拟器证据和真机证据分开记录；本次没有真机验收声明。

## 修复的接入问题

1. 首次构建生成 tsconfig 导致快照变化：示例先运行 prepare，正式验收仍严格检查源码变化。
2. DevTools 在清空 dist 时缓存“app.json 不存在”：复用工程刷新、fileutils 重置和 engine build，再执行场景；不重放失败交互。
3. 验收任务结束错误关闭共享连接：由服务持有连接，任务仅持有租约和日志订阅；最后使用者退出后回收。
4. monorepo 项目根目录被文档工作区探测提升，截图落到工作区根目录：验收保留显式项目根目录，运行适配器按任务项目解析证据路径。
5. Node 20 不支持 execa 10 的 Set.union：无模型链路使用 execa 9；accept/MCP 独立轻量 CLI 入口避免加载编译插件。

## 宿主验证与远端门禁

- 实际 Codex CLI 宿主完成 inspect → start → status → report → screenshot-1.png；任务 `e4bd74ad-9af1-4ae3-9ceb-3952d97682d0` 为 passed，stale=false，截图计数为 1。宿主只调用工具，未编辑代码。另验证未记录信任时返回 action_required，未执行项目脚本。此结果不代表 Codex 桌面 App UI 的安装验证。
- Windows/Linux 和 Node 22.12.0 由迁移 CI 矩阵验证；本机结果仅为 macOS。
- PR 在这些门禁完成前保持 Draft，不自动合并或发布。

## 本次真实运行任务

| 工程 | 场景 | jobId | 结果 |
| --- | --- | --- | --- |
| native | passed | `68c22404-b4af-46d2-9c79-2299d39040d3` | passed |
| native | changed-scenario-needs-review | `3f69988d-30ef-439e-a87b-f07355fdc12c` | action_required |
| native | injected-assertion-failure | `6fab076f-7ed0-4309-b50c-219b5e3a2267` | failed |
| native | repaired-scenario | `1167a960-95ad-4585-a388-7fdb6934ad08` | passed |
| wevu | passed | `06903305-a727-4e6a-b97d-ffec7cd09265` | passed |
| wevu | changed-scenario-needs-review | `ec67c53c-67d9-4f49-8fa8-f7b2ba9b6d46` | action_required |
| wevu | injected-assertion-failure | `80387753-152c-4e18-bd06-95185b4c6a71` | failed |
| wevu | repaired-scenario | `11be464a-3bc1-4816-a0c8-bfc95e53a1b9` | passed |
