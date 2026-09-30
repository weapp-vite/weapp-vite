# WeChat DevTools Runtime E2E Checklist

## 环境前提

- 没有其他仓库级 e2e、automator、watch 或验证服务占用测试资源；保留手动 IDE，未知归属不清理。
- 每轮核对官方最新稳定版及查询时间，通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 显式选择；预检、启动、构建、恢复使用同一 CLI，并核对实际连接宿主。
- 仅按用户明确指定使用其他渠道或版本；最新稳定版不可确认、未安装或未登录时报告阻塞，不自行降级或切换 RC/nightly。
- WeChat DevTools 已登录。
- 服务端口已开启。
- 目标 `project.config.json` 使用真实 AppID。

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

## 跨平台与收尾

- OS-only 失败先查 command resolution、path normalization、CRLF 和 filesystem assumptions。
- Windows launcher 不假设 `pnpm` 等命令与 Unix 一样解析；优先 `execa`。
- 启动失败、恢复和 teardown 只释放登记的本任务资源；禁止按名称杀全部 IDE，禁止删除全局 session、port-lease、登录数据和用户缓存。
- 确认手动实例、其他项目及不同安装版本保留，重复清理幂等；记录官方版本来源、查询时间、实际 IDE/基础库版本。
- 运行后保全验收日志、DOM 和截图证据，再清理 DevTools 写入的换行噪音及与任务无关的生成文件。
