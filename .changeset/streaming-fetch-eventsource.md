---
"@wevu/web-apis": minor
"wevu": minor
"weapp-vite": minor
"weapp-ide-cli": patch
"@weapp-core/constants": patch
"@mpcore/simulator": patch
"create-weapp-vite": patch
"@weapp-vite/i18n": patch
"@weapp-vite/mcp": patch
"@weapp-vite/react": patch
"@weapp-vite/web": patch
"@wevu/compiler": patch
"@wevu/test-utils": patch
---

feat: 支持微信小程序复用 Web 的 Fetch 响应流和 EventSource 写法

提供增量 UTF-8 解码、标准流消费、取消、SSE 事件解析和重连，并在第三方模块执行前注入所需构造器。缺少早期真实 HTTP 状态码或分块 API 时明确报告能力限制，保留普通缓冲请求与现有 Wevu 入口。

同步更新共享常量的直接依赖包版本范围与脚手架依赖。

真实 IDE 退出核验以固定单调时间预算检查完整进程清单，允许多轮新进程采样，不因其他程序的短时进程活动提前耗尽固定轮数；未知身份与仍存活的所选安装继续拒绝释放。
