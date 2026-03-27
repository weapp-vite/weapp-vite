---
'create-weapp-vite': patch
'rolldown-require': patch
'weapp-vite': patch
---

修复新建项目在使用 Yarn 安装依赖时的 `rolldown` peer dependency 警告。`weapp-vite` 现将 `rolldown-plugin-dts` 回退到与 `rolldown@1.0.0-rc.11` 兼容的 `0.22.5`，并同步重新发布 `rolldown-require` 与 `create-weapp-vite`，确保脚手架默认生成项目的依赖版本保持一致，减少安装期的误导性告警。
