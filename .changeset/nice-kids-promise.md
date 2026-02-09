---
"weapp-ide-cli": patch
---

fix: 登录失效场景优化错误展示，避免输出原始对象堆栈。

- 执行微信 CLI 时关闭原始 `stderr` 直通输出，避免 `code/message` 对象和堆栈原样刷屏。
- 登录失效提示改为结构化摘要（`code` / `message`），提升可读性。
- 保持 `r` 重试交互，并补充对应单元测试。
