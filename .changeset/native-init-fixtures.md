---
"@weapp-core/init": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

增强 `weapp-vite init` 对原生微信小程序项目的迁移能力，自动识别源码根目录并补齐受管 TypeScript 支持文件，使 JS/TS 原生模板初始化后可以直接通过 `weapp-vite build` 构建。
