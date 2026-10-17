---
"@weapp-vite/miniprogram-automator": minor
"@mpcore/simulator": minor
"@weapp-vite/devtools-runtime": minor
"@weapp-core/constants": minor
"weapp-ide-cli": patch
"@weapp-vite/mcp": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

feat(automator): 完整吸收官方 miniprogram-automator 0.13.0 的公开协议、CDP、触摸字段和诊断能力。新增 `MiniProgram.send()`、共享连接的 `CDP()` 及可取消事件订阅；`changedTouches` 优先于保留的弃用别名 `changeTouches`，启动失败附带脱敏、有界的 CLI 输出。

`Transport.close()`、`Connection.dispose()`、`MiniProgram.disconnect()` 与共享会话释放方法的返回值改为 `Promise<void>`，调用方应使用 `await` 确认关闭完成。断开立即拒绝未决 RPC，避免上游清理回归；并发清理共享结果，超时或释放失败保留资源归属及重试机会，同时保留业务错误与清理错误。

headless 同步触摸传递、异步断开和已有真实语义的五个公开协议，CDP 与其他协议明确报告 `HEADLESS_PROTOCOL_UNSUPPORTED`。同步 IDE CLI、MCP、日志、doctor 与重连的等待边界及迁移文档。
