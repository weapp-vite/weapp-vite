---
"@weapp-vite/miniprogram-automator": patch
---

新增 AppService JS 堆内存能力探测，返回已用与已分配字节或明确的不支持原因；连接超时和无效响应继续报错，避免性能比较将未知宿主内存误记为零。
