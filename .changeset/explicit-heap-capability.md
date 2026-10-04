---
"@weapp-vite/miniprogram-automator": patch
---

将基础库 heap 协议明确返回的 `Method not implemented.` 识别为不支持该能力，保留真实错误边界与后续重新探测；不将缺失的宿主内存数据伪装为可用值。
