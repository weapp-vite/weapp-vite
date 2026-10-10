---
'@weapp-vite/miniprogram-automator': patch
---

feat(automator): 新增 AppService JS heap 能力探测，区分真实内存观察值、不支持和协议错误。

- 新增 AppService JS heap 能力探测，返回已用/已分配字节或明确不支持原因；`Method not implemented.` 仅标记能力不支持。连接超时、无效响应及其他真实错误继续报错，未知内存不记为零并允许后续重新探测。
