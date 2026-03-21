---
"weapp-vite": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

升级 `htmlparser2` 到 `^12.0.0`，同步刷新 workspace catalog、脚手架生成 catalog 与锁文件，确保 `weapp-vite` 和 `@weapp-vite/web` 后续发布时解析器版本保持一致。考虑到 `create-weapp-vite` 会下发同一份 catalog 版本，本次也一并补充脚手架包的补丁版本变更。
