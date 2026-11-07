---
'@mpcore/simulator': patch
'create-weapp-vite': patch
---

fix: 修复模拟器缺少微信包内 WASM 执行和二进制文件读写能力的问题，支持真实 SQLite 引擎及会话隔离的数据库快照持久化。

文件系统失败回调补齐微信 `errMsg` 契约，确保数据库首次加载和重复删除时正确识别文件缺失。

按微信语义，无编码的 `readFileSync()` 返回 `ArrayBuffer`，读取文本需显式传入 `utf8`；`getFileSnapshot()` 的值类型扩展为 `string | ArrayBuffer`，保留二进制快照内容。
