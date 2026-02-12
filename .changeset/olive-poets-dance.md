---
"weapp-ide-cli": patch
---

feat(weapp-ide-cli)：新增 `--non-interactive`、`--login-retry` 与 `--login-retry-timeout`，并在 CI 或非 TTY 场景下对登录失效（code:10）快速失败，避免卡在按键重试交互。
