# WeChat DevTools Runtime E2E Checklist

## 环境前提

- 没有其他仓库级 e2e、DevTools、automator、watch 或本地验证服务正在运行。
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
- 运行后检查并清理 DevTools 写入的换行噪音和无关 `docs/reports/**`。
