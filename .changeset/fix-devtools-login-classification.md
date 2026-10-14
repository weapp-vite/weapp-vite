---
"weapp-ide-cli": patch
---

fix: 修复官方 CLI 通用 code 10（例如项目路径不存在）被误判为登录失效的问题，统一 CLI 与 automator 的登录分类，并保留明确登录错误的重试与退出行为。
