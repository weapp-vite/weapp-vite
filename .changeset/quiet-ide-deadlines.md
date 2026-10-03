---
"@weapp-vite/miniprogram-automator": minor
"weapp-ide-cli": minor
"weapp-vite": patch
"create-weapp-vite": patch
---

为微信 IDE 启动、连接、版本与 App ready、登录提示和有限重试共享总截止时间，传递取消信号并保留原始原因与阶段诊断。仅释放本次持有的连接、CLI 子进程和端口租约，隔离迟到结果，移除就绪后的固定等待。Doctor 运行时探针共用总预算并记录脱敏清理证据；默认静态检查继续只读。
