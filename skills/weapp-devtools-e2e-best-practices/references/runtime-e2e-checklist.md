# WeChat DevTools Runtime E2E Checklist

## 环境前提

- 没有其他仓库级 e2e、automator、watch 或验证服务占用测试资源；保留手动 IDE，未知归属不清理。
- 全面真实 IDE suite 必须从仓库根目录的 `main` 工作树运行。启动前执行 `git fetch origin main`、`git switch main`、`git pull --ff-only origin main`，确认 `HEAD == origin/main` 且工作树干净；运行期间不得切换分支或编辑源码。`.codex-tmp` 和其他分支仅用于修复、最小复现、headless 或局部诊断，修复合并并重建后再回主线验收。主线要求不改变机器租约和全机串行约束。
- 每轮核对官方最新稳定版及查询时间，通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 显式选择固定安装；入口将选择传给本轮 `WEAPP_IDE_CLI_PATH` 和子进程，预检、公共 CLI、MCP、启动、构建、恢复使用同一目标，不临时改写用户全局配置。
- 仅按用户明确指定使用其他渠道或版本；最新稳定版不可确认、未安装或未登录时报告阻塞，不自行降级或切换 RC/nightly。
- 日常开发与 E2E 复用一个已登录 Stable 宿主、一个微信账号；允许该宿主承载多个项目，无需为测试再建账号。正常登录过期时重新登录，不在两份安装间复制票据。
- 服务端口已开启。
- 安装元数据中的 IDE 版本、实际宿主安装身份、HTTP/WebSocket 监听端口归属与 `toolInfo()` 的 IDE/基础库版本一致；不能拿 Electron 版本、默认路径、已登录或端口号本身作身份凭证。
- 缓存与会话包含安装身份；旧记录身份不明或显式端口属于另一安装时停止复用并诊断，不按端口文件的最近写入时间跨安装选择。
- 目标 `project.config.json` 使用真实 AppID。

## 任务互斥

- 所有 E2E 入口共用同机同用户的机器租约，跨 worktree 仍互斥；headless、CI、直接 Vitest、聚合脚本均参与，修改项目状态目录不能绕过。
- `Runtime busy` 表示任务调度层需要等待原持有者释放后重试；不得删锁、清缓存或启动另一版本抢占宿主。
- 根入口持有租约直到子任务及收尾结束；子进程凭 owner token 和活 PID 核验借用，完成时仅释放自己的登记。父进程已退出但子任务仍存活时不能回收；未知持有者保持原状。
- 保留项目租约、端口租约和同一 suite 的多会话；普通已建立的项目连接不长期占据机器租约，登录、启动等宿主变更仍受保护。
- headless 只参与调度互斥，不读取或修改真实 IDE 的登录数据；机器租约不能替代真实 IDE 的版本、登录和端口预检。

## Suite 设计

- 一个 `e2e-app` 复用一个 automator 会话。
- 在 `describe` 级别初始化，在 `afterAll` 清理。
- 多路由通过 `miniProgram.reLaunch(...)` 切换。
- provider-compatible 场景通过 `WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools|headless` 复用。
- DevTools/headless 有语义差异时，以稳定可复现的真实 DevTools 行为为准并修复 mpcore。

## 配置同步

- 新增页面时更新 `project.private.config.json`。
- 条目位置：`condition.miniprogram.list`。
- 不要使用 `touristappid`。

## 推荐验证

- `node --import tsx scripts/check-e2e-ide-shared-launch.ts`
- `pnpm vitest run -c ./e2e/vitest.e2e.devtools.config.ts <file>`
- 对应 headless provider 场景或 mpcore unit/integration + browser e2e。
- 公开类型变化时补 owning mpcore package 的 `test:types`。
- 租约或入口变更时，先运行 `pnpm --filter @weapp-vite/devtools-runtime exec vitest run test/lease.test.ts test/machineLease.test.ts`；再串行运行 `pnpm vitest run -c e2e/vitest.e2e.internal.config.ts e2e/scripts/run-e2e-commands.test.ts e2e/scripts/suiteRunner.test.ts`，覆盖跨目录子进程、合法继承、取消、异常退出和幂等释放。

## 跨平台与收尾

- OS-only 失败先查 command resolution、path normalization、CRLF 和 filesystem assumptions。
- Windows launcher 不假设 `pnpm` 等命令与 Unix 一样解析；优先 `execa`。
- 启动失败、恢复和 teardown 只释放登记的本任务资源；禁止按名称杀全部 IDE，禁止删除全局 session、port-lease、登录数据和用户缓存。
- 不自动退出账号、复制凭据或为求绿重新安装/切换版本；复用手动宿主时只释放自己的连接和资源，不关闭用户的项目窗口。
- 确认手动实例、其他项目及不同安装版本保留，重复清理幂等；记录官方版本来源、查询时间、实际 IDE/基础库版本。
- 诊断记录选择的安装、实际宿主、端口归属、登录布尔状态和租约占用结果；不记录登录票据或租约 token。
- 运行后保全验收日志、DOM 和截图证据，再清理 DevTools 写入的换行噪音及与任务无关的生成文件。
