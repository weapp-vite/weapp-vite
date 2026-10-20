---
"weapp-vite": patch
"create-weapp-vite": patch
---

为两种 Vue SFC 声明生成模式接入统一的 Volar 适配器，保留小程序原生模板 ref 的精确类型，并正确解析用户配置的相对插件路径和插件选项。

修复 vue-tsc 临时配置中的 TypeScript 枚举序列化，将 API 使用的数值选项转换为合法 JSON 配置，同时保留用户覆盖值和库类型设置。
