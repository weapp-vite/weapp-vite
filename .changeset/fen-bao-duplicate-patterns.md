---
'weapp-vite': minor
---

优化共享 chunk 拆分：当模块仅被分包间接引用时不再强制回退主包，并新增 `weapp.chunks.forceDuplicatePatterns` 配置，支持以 glob/正则声明可复制到分包的共享目录，同时在构建日志中提示已忽略的伪主包引用；复制完成后会移除主包的虚拟共享产物，避免额外的 `weapp_shared_virtual/*` 文件膨胀主包体积。
