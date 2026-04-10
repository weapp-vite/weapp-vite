---
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

修复组件 props 在传入 `undefined` 后被小程序运行时视为 `null` 时的兼容缺口。`wevu` 现在提供显式的 `allowNullPropInput` 开关，并补齐显式 `properties` 分支的归一化逻辑；`weapp-vite` 生成的 Vue SFC 组件会默认开启该兼容行为，避免微信开发者工具对 `String` / `Number` 等已声明类型 props 反复输出 `null` 类型告警，同时保留手动关闭的能力。
