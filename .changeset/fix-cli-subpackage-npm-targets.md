---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 CLI 构建本地分包 npm 时未向 `npm.buildOptions` 传入分包最终输出目标的问题，使自定义输出目录和跳过构建配置生效，同时保留未配置回调时的共享产物复制与缓存行为。
