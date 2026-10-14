---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): 减少默认 npm 构建中的重复依赖元信息读取，保持小程序包识别、显式 include、分包依赖和构建错误行为一致。
