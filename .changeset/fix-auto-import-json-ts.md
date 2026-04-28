---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复自动导入组件扫描对 `*.json.ts` 配置文件的候选去重逻辑，避免同一组件在初始扫描中被重复注册并输出误导性的组件重名告警。
