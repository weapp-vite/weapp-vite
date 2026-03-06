---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 的 `props -> properties` 归一化能力缺口：新增对 `optionalTypes` 与 `observer` 的透传，数组类型会规范化为 `type + optionalTypes`，并在缺失 `type` 时回填 `null` 以贴近小程序 `properties` 语义。同时修复 `weapp-vite` 自动组件元数据提取逻辑，`json.properties` 现在会合并 `type` 与 `optionalTypes` 生成联合类型，避免 typed-components/html custom data 类型信息偏窄。
