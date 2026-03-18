---
"weapp-vite": patch
"create-weapp-vite": patch
---

完善 plugin-demo 对小程序插件混合能力的演示，补充插件内 Vue SFC、TypeScript、SCSS、原生页面与公开组件组合示例；同时修复插件构建时插件内 `usingComponents` 绝对路径按主包根目录解析导致的误报告警，并补充对应构建回归测试。
