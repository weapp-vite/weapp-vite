---
'create-weapp-vite': patch
---

优化官方模板的样式校验默认配置。现在模板项目的 `stylelint` 脚本会默认覆盖 `wxss` 文件，并通过 VS Code 工作区设置将 `*.wxss` 关联为 `css`，让 `stylelint` 插件在小程序样式文件中也能直接提供校验与提示。
