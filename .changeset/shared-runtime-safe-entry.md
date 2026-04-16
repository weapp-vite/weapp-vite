---
'@weapp-core/shared': patch
'wevu': patch
'weapp-vite': patch
'@weapp-vite/web': patch
'weapp-ide-cli': patch
'create-weapp-vite': patch
---

将 `@weapp-core/shared` 根入口收敛为运行时安全入口，移除对 `node:fs`、`node:path`、`node:crypto`、`node:buffer` 的静态依赖；Node 专用文件系统能力改为通过 `@weapp-core/shared/fs` 子入口提供，避免 `wevu` 等小程序运行时包在消费 shared 平台能力时误触发 Node 内置模块报错。
