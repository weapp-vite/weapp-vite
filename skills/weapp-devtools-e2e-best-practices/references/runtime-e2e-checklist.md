# WeChat DevTools Runtime E2E Checklist

## 环境前提

- WeChat DevTools 已登录。
- 服务端口已开启。
- 目标 `project.config.json` 使用真实 AppID。

## Suite 设计

- 一个 `e2e-app` 复用一个 automator 会话。
- 在 `describe` 级别初始化，在 `afterAll` 清理。
- 多路由通过 `miniProgram.reLaunch(...)` 切换。

## 配置同步

- 新增页面时更新 `project.private.config.json`。
- 条目位置：`condition.miniprogram.list`。
- 不要使用 `touristappid`。

## 推荐验证

- `node --import tsx scripts/check-e2e-ide-shared-launch.ts`
- `pnpm vitest run -c ./e2e/vitest.e2e.devtools.config.ts <file>`
